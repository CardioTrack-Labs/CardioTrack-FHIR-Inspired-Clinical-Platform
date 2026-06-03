import numpy as np
import scipy.signal as signal
import json
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ECGProcessor")

def butter_bandpass(lowcut, highcut, fs, order=1):
    """Generate Butter bandpass filter coefficients."""
    nyq = 0.5 * fs
    low = lowcut / nyq
    high = highcut / nyq
    b, a = signal.butter(order, [low, high], btype='band')
    return b, a

def butter_bandpass_filter(data, lowcut, highcut, fs, order=1):
    """Apply butter bandpass filter to the data."""
    b, a = butter_bandpass(lowcut, highcut, fs, order=order)
    y = signal.filtfilt(b, a, data)
    return y

def pan_tompkins_detector(raw_signal, fs):
    """
    Detect R-peaks in raw ECG signal using the Pan-Tompkins algorithm.
    Returns:
        r_peaks (list of ints): Indices of detected R-peaks in the raw signal.
        filtered_signal (np.ndarray): Bandpass-filtered signal.
    """
    # 1. Bandpass filter (5-15 Hz)
    filtered = butter_bandpass_filter(raw_signal, 5.0, 15.0, fs, order=2)
    
    # 2. Derivative filter to highlight QRS slope
    # y[n] = (2*x[n] + x[n-1] - x[n-3] - 2*x[n-4]) / 8
    d_coef = np.array([2.0, 1.0, 0.0, -1.0, -2.0]) / 8.0
    derivative = signal.lfilter(d_coef, 1.0, filtered)
    
    # 3. Squaring
    squared = derivative ** 2
    
    # 4. Moving window integration
    # Window width is typically 150ms
    window_len = int(0.150 * fs)
    if window_len < 1:
        window_len = 1
    mwi = np.convolve(squared, np.ones(window_len) / window_len, mode='same')
    
    # 5. Peak Detection using scipy.signal.find_peaks
    # Min distance between R-peaks is usually 300ms (max HR ~200 bpm)
    min_dist = int(0.300 * fs)
    if min_dist < 1:
        min_dist = 1
        
    # Find peaks in the moving window integration (MWI) signal
    mwi_peaks, _ = signal.find_peaks(mwi, distance=min_dist, prominence=np.max(mwi) * 0.1)
    
    # Refine R-peaks by looking for the maximum in the raw/filtered signal around the MWI peaks
    # The MWI peak is typically delayed relative to the actual R-peak (due to convolution window).
    # We look in a window of 150ms before the MWI peak.
    r_peaks = []
    search_window = int(0.150 * fs)
    
    for mp in mwi_peaks:
        start = max(0, mp - search_window)
        end = min(len(filtered), mp + 20)
        if start >= end:
            continue
        # Find index of max value in the filtered signal within search window
        ref_peak = start + np.argmax(np.abs(filtered[start:end]))
        r_peaks.append(int(ref_peak))
        
    # Remove duplicates and sort
    r_peaks = sorted(list(set(r_peaks)))
    return r_peaks, filtered

def calculate_hrv_metrics(r_peaks, fs):
    """
    Calculate HRV metrics from R-peaks.
    Returns:
        metrics (dict): Contains heart rate statistics and HRV indices.
    """
    if len(r_peaks) < 3:
        logger.warning("Not enough R-peaks to compute HRV metrics (< 3 peaks).")
        return {
            "heart_rate_mean": 0.0,
            "heart_rate_min": 0.0,
            "heart_rate_max": 0.0,
            "sdnn": 0.0,
            "rmssd": 0.0,
            "pnn50": 0.0,
            "r_peaks_count": len(r_peaks),
            "interpretation": "poor",
            "rr_intervals": []
        }
        
    # R-R intervals in milliseconds
    rr_intervals = np.diff(r_peaks) / fs * 1000.0
    
    # Instantaneous heart rates
    heart_rates = 60000.0 / rr_intervals
    
    # Filter extreme/unrealistic values (e.g. HR outside 30 - 220 bpm) for cleaner clinical metrics
    valid_mask = (heart_rates >= 30.0) & (heart_rates <= 220.0)
    if np.sum(valid_mask) > 0:
        hr_mean = float(np.mean(heart_rates[valid_mask]))
        hr_min = float(np.min(heart_rates[valid_mask]))
        hr_max = float(np.max(heart_rates[valid_mask]))
    else:
        hr_mean = float(np.mean(heart_rates))
        hr_min = float(np.min(heart_rates))
        hr_max = float(np.max(heart_rates))
        
    # SDNN: Standard deviation of normal-to-normal intervals
    sdnn = float(np.std(rr_intervals, ddof=1))
    
    # RMSSD: Root mean square of successive differences
    diff_rr = np.diff(rr_intervals)
    rmssd = float(np.sqrt(np.mean(diff_rr ** 2)))
    
    # pNN50: Percentage of successive RR intervals differing by > 50 ms
    nn50 = np.sum(np.abs(diff_rr) > 50.0)
    pnn50 = float(nn50 / len(diff_rr) * 100.0) if len(diff_rr) > 0 else 0.0
    
    # Clinical interpretation based on SDNN
    # SDNN > 100ms: Normal / Healthy HRV
    # 50 - 100ms: Reduced HRV
    # < 50ms: Poor / High Risk HRV
    if sdnn > 100.0:
        interpretation = "normal"
    elif sdnn >= 50.0:
        interpretation = "reduced"
    else:
        interpretation = "poor"
        
    return {
        "heart_rate_mean": round(hr_mean, 2),
        "heart_rate_min": round(hr_min, 2),
        "heart_rate_max": round(hr_max, 2),
        "sdnn": round(sdnn, 2),
        "rmssd": round(rmssd, 2),
        "pnn50": round(pnn50, 2),
        "r_peaks_count": len(r_peaks),
        "interpretation": interpretation,
        "rr_intervals": rr_intervals.tolist()
    }

def process_ecg_file(file_path, fs=250):
    """
    Read ECG file, parse floats, run Pan-Tompkins and compute HRV.
    Supported formats: space-separated, comma-separated, or newline-separated.
    """
    logger.info(f"Loading ECG data from: {file_path}")
    with open(file_path, 'r') as f:
        content = f.read().strip()
        
    # Attempt space-separated parsing
    raw_data = []
    if " " in content:
        try:
            raw_data = [float(x) for x in content.split() if x]
        except ValueError:
            pass
            
    # Try comma-separated parsing
    if len(raw_data) <= 1 and "," in content:
        try:
            raw_data = [float(x) for x in content.split(",") if x]
        except ValueError:
            pass
            
    # Try newline-separated parsing
    if len(raw_data) <= 1:
        try:
            raw_data = [float(x) for x in content.splitlines() if x]
        except ValueError:
            pass
            
    if len(raw_data) < 100:
        raise ValueError(f"ECG record is too short or invalid. Found {len(raw_data)} samples.")
        
    logger.info(f"Parsed {len(raw_data)} ECG samples successfully.")
    
    # Run Pan-Tompkins
    r_peaks, filtered_signal = pan_tompkins_detector(raw_data, fs)
    logger.info(f"Pan-Tompkins completed. Found {len(r_peaks)} R-peaks.")
    
    # Calculate HRV
    metrics = calculate_hrv_metrics(r_peaks, fs)
    
    # Package additional details for the UI visualization
    # We downsample the signal if it's very large, or keep first 2000 points to make D3.js loading instantaneous.
    # The client can draw raw_signal, filtered_signal and r_peaks
    plot_limit = min(5000, len(raw_data))
    metrics["raw_signal_preview"] = [round(x, 4) for x in raw_data[:plot_limit]]
    metrics["filtered_signal_preview"] = [round(x, 4) for x in filtered_signal[:plot_limit]]
    metrics["r_peaks_preview"] = [int(p) for p in r_peaks if p < plot_limit]
    
    return metrics
