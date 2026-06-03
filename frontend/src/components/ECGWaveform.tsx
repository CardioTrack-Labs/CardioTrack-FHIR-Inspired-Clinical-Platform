import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

interface ECGWaveformProps {
  rawSignal: number[];
  filteredSignal?: number[];
  rPeaks: number[];
  samplingRate?: number;
}

export const ECGWaveform: React.FC<ECGWaveformProps> = ({
  rawSignal,
  filteredSignal = [],
  rPeaks,
  samplingRate = 250,
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [showFiltered, setShowFiltered] = useState(true);
  const [showRaw, setShowRaw] = useState(false);

  useEffect(() => {
    if (!svgRef.current || rawSignal.length === 0) return;

    // Clear previous SVG contents
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    // Dimensions
    const width = svgRef.current.clientWidth || 800;
    const height = 280;
    const margin = { top: 20, right: 30, bottom: 40, left: 50 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    // Create scales
    // X-axis: time in seconds
    const duration = rawSignal.length / samplingRate;
    const xScale = d3.scaleLinear()
      .domain([0, duration])
      .range([0, chartWidth]);

    // Y-axis: voltage (centered)
    // Find min and max of raw and filtered signals to set domain
    const allVals = [...rawSignal, ...filteredSignal];
    const minVal = d3.min(allVals) ?? -1.5;
    const maxVal = d3.max(allVals) ?? 1.5;
    const pad = (maxVal - minVal) * 0.22 || 0.4;

    const yScale = d3.scaleLinear()
      .domain([minVal - pad, maxVal + pad])
      .range([chartHeight, 0]);

    // Main container group
    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // --- GRID PATTERN (ECG Paper Style) ---
    // Define patterns in <defs>
    const defs = svg.append('defs');
    
    // Minor grid: 0.04s (10mm or 1mv grid details)
    // Major grid: 0.2s
    const minorGridSize = xScale(0.04) - xScale(0);
    const majorGridSize = xScale(0.2) - xScale(0);

    // Minor pattern (small square: 1mm x 1mm approximate)
    defs.append('pattern')
      .attr('id', 'minorGrid')
      .attr('width', minorGridSize)
      .attr('height', minorGridSize)
      .attr('patternUnits', 'userSpaceOnUse')
      .append('path')
      .attr('d', `M ${minorGridSize} 0 L 0 0 0 ${minorGridSize}`)
      .attr('fill', 'none')
      .attr('stroke', 'rgba(239, 68, 68, 0.07)')
      .attr('stroke-width', 0.5);

    // Major pattern (large square: 5mm x 5mm)
    defs.append('pattern')
      .attr('id', 'majorGrid')
      .attr('width', majorGridSize)
      .attr('height', majorGridSize)
      .attr('patternUnits', 'userSpaceOnUse')
      .append('rect')
      .attr('width', majorGridSize)
      .attr('height', majorGridSize)
      .attr('fill', 'url(#minorGrid)')
      .attr('stroke', 'rgba(239, 68, 68, 0.25)')
      .attr('stroke-width', 1.0);

    // Draw grid background
    g.append('rect')
      .attr('width', chartWidth)
      .attr('height', chartHeight)
      .attr('fill', 'url(#majorGrid)');

    // Clip path to keep lines inside grid area during zoom/pan
    defs.append('clipPath')
      .attr('id', 'clip')
      .append('rect')
      .attr('width', chartWidth)
      .attr('height', chartHeight);

    // Inner group for zoomable content
    const chartContent = g.append('g')
      .attr('clip-path', 'url(#clip)');

    // Line generators
    const rawLine = d3.line<number>()
      .x((_, i) => xScale(i / samplingRate))
      .y(d => yScale(d));

    const filteredLine = d3.line<number>()
      .x((_, i) => xScale(i / samplingRate))
      .y(d => yScale(d));

    // Paths
    let rawPath: d3.Selection<SVGPathElement, number[], null, undefined> | null = null;
    let filteredPath: d3.Selection<SVGPathElement, number[], null, undefined> | null = null;

    if (showRaw) {
      rawPath = chartContent.append('path')
        .datum(rawSignal)
        .attr('class', 'raw-line')
        .attr('fill', 'none')
        .attr('stroke', 'var(--blue)')
        .attr('stroke-width', 1.5)
        .attr('d', rawLine);
    }

    if (showFiltered && filteredSignal.length > 0) {
      filteredPath = chartContent.append('path')
        .datum(filteredSignal)
        .attr('class', 'filtered-line')
        .attr('fill', 'none')
        .attr('stroke', 'var(--primary)')
        .attr('stroke-width', 1.8)
        .attr('d', filteredLine);
    }

    // --- DRAW R-PEAKS (Red Dots) ---
    // Draw circles at R-peaks
    // The Y coordinate will be corresponding to the signal value at that index
    const peakData = rPeaks.map(pIdx => {
      const x = pIdx / samplingRate;
      // Use filtered signal if showing, otherwise raw
      const signalToUse = (showFiltered && filteredSignal.length > 0) ? filteredSignal : rawSignal;
      const y = signalToUse[pIdx] ?? 0;
      return { x, y, idx: pIdx };
    });

    const peaksGroup = chartContent.append('g').attr('class', 'peaks');
    
    const drawPeaks = () => {
      peaksGroup.selectAll('*').remove();
      
      peaksGroup.selectAll('circle')
        .data(peakData)
        .enter()
        .append('circle')
        .attr('cx', d => xScale(d.x))
        .attr('cy', d => yScale(d.y))
        .attr('r', 4.5)
        .attr('fill', 'var(--red)')
        .attr('stroke', '#ffffff')
        .attr('stroke-width', 1.5)
        .style('cursor', 'pointer')
        .append('title')
        .text(d => `Peak index: ${d.idx}\nTime: ${d.x.toFixed(3)}s\nValue: ${d.y.toFixed(3)}`);
    };

    drawPeaks();

    // --- AXES ---
    const xAxis = d3.axisBottom(xScale)
      .ticks(10)
      .tickFormat(d => `${d} s`);

    const yAxis = d3.axisLeft(yScale)
      .ticks(5)
      .tickFormat(d => `${d} mV`);

    const gX = g.append('g')
      .attr('class', 'axis axis--x')
      .attr('transform', `translate(0,${chartHeight})`)
      .call(xAxis);

    g.append('g')
      .attr('class', 'axis axis--y')
      .call(yAxis);

    // Style axes
    svg.selectAll('.axis path, .axis line')
      .attr('stroke', 'var(--border)');
    svg.selectAll('.axis text')
      .attr('fill', 'var(--ink-3)')
      .style('font-size', '10.5px')
      .style('font-family', 'var(--mono)');

    // --- ZOOM BEHAVIOR ---
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 15])  // Zoom level 1x to 15x
      .translateExtent([[0, 0], [chartWidth, chartHeight]])
      .extent([[0, 0], [chartWidth, chartHeight]])
      .on('zoom', (event) => {
        const transform = event.transform;
        
        // Rescale X scale
        const newXScale = transform.rescaleX(xScale);
        
        // Update paths
        if (rawPath) {
          rawPath.attr('d', d3.line<number>()
            .x((_, i) => newXScale(i / samplingRate))
            .y(d => yScale(d)) as any);
        }
        if (filteredPath) {
          filteredPath.attr('d', d3.line<number>()
            .x((_, i) => newXScale(i / samplingRate))
            .y(d => yScale(d)) as any);
        }

        // Update R-peaks positions
        peaksGroup.selectAll('circle')
          .attr('cx', (d: any) => newXScale(d.x));

        // Update grid background transform
        g.select('#majorGrid')
          .attr('width', majorGridSize * transform.k)
          .attr('height', majorGridSize)
          .attr('x', transform.x);
          
        // Update X axis
        gX.call(xAxis.scale(newXScale));
        
        // Style axes again
        svg.selectAll('.axis text')
          .attr('fill', 'var(--ink-3)')
          .style('font-size', '10.5px');
      });

    // Attach zoom
    svg.call(zoom);

    // Reset zoom helper
    return () => {
      svg.on('.zoom', null);
    };

  }, [rawSignal, filteredSignal, rPeaks, samplingRate, showFiltered, showRaw]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 13, color: 'var(--ink-2)', display: 'flex', gap: 14 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={showFiltered}
              onChange={e => {
                setShowFiltered(e.target.checked);
                if (!e.target.checked && !showRaw) setShowRaw(true);
              }}
              style={{ accentColor: 'var(--primary)' }}
            />
            <span style={{ fontWeight: 500, color: 'var(--primary)' }}>Φιλτραρισμένο Σήμα (Pan-Tompkins)</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={showRaw}
              onChange={e => {
                setShowRaw(e.target.checked);
                if (!e.target.checked && !showFiltered) setShowFiltered(true);
              }}
              style={{ accentColor: 'var(--blue)' }}
            />
            <span style={{ fontWeight: 500, color: 'var(--blue)' }}>Raw ECG Σήμα</span>
          </label>
        </div>
        <div style={{ fontSize: 11, color: 'var(--ink-3)', fontStyle: 'italic' }}>
          * Σύρετε για πλοήγηση (Pan) · Scroll για μεγέθυνση (Zoom)
        </div>
      </div>

      <div
        style={{
          background: 'oklch(12% 0.01 240)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--r-lg)',
          padding: '12px',
          boxShadow: 'var(--sh-in)',
          position: 'relative',
        }}
      >
        <svg
          ref={svgRef}
          style={{
            width: '100%',
            height: 280,
            display: 'block',
          }}
        />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--ink-3)', fontFamily: 'var(--mono)' }}>
        <span>0.0s</span>
        <span>Lead II · Fs: {samplingRate} Hz · Total Samples: {rawSignal.length}</span>
        <span>{(rawSignal.length / samplingRate).toFixed(1)}s</span>
      </div>
    </div>
  );
};
