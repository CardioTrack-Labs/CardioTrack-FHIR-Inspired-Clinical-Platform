import os
import json
import time
import requests
import pika
import psycopg2
from dotenv import load_dotenv
from ecg_processor import process_ecg_file
import logging

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("PythonService")

load_dotenv()

# Configuration
DATABASE_URL = os.getenv("DATABASE_URL", "postgres://postgres.hjwuliabvfsrltdxrmsl:5%3F%246UIqQ123@aws-0-eu-west-1.pooler.supabase.com:6543/postgres")
RABBITMQ_URL = os.getenv("RABBITMQ_URL", "amqp://guest:guest@localhost:5672/")
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8080")

def resolve_file_path(received_path):
    """Resolve file path to make it accessible regardless of working directory."""
    if os.path.exists(received_path):
        return received_path
    
    # Try relative to the backend directory
    backend_path = os.path.join("/home/sakis/Projects/CardioTrack-FHIR-Inspired-Clinical-Platform/backend", received_path.lstrip("./"))
    if os.path.exists(backend_path):
        return backend_path
        
    # Try going up one directory (e.g. from inside python-service directory)
    up_path = os.path.join("..", received_path)
    if os.path.exists(up_path):
        return up_path
        
    return received_path

def get_db_connection():
    """Establish and return a connection to the PostgreSQL database."""
    conn = psycopg2.connect(DATABASE_URL)
    return conn

def notify_backend(record_id):
    """Notify the Go backend that analysis is completed to trigger WebSocket updates."""
    url = f"{BACKEND_URL}/api/v1/internal/ecg/{record_id}/notify"
    try:
        response = requests.post(url, timeout=5)
        if response.status_code == 200:
            logger.info(f"Successfully notified Go backend for record {record_id}")
        else:
            logger.warning(f"Backend returned non-200 status when notifying for record {record_id}: {response.status_code}")
    except Exception as e:
        logger.error(f"Failed to notify Go backend for record {record_id}: {e}")

def process_message(ch, method, properties, body):
    logger.info(f"Received processing task: {body.decode()}")
    db_conn = None
    try:
        # Parse payload
        payload = json.loads(body.decode())
        record_id = payload.get("ecg_record_id")
        file_path = payload.get("file_path")
        fs = payload.get("sampling_rate", 250) # default to 250 Hz if not provided
        
        if not record_id or not file_path:
            logger.error("Invalid message payload: missing record_id or file_path")
            ch.basic_ack(delivery_tag=method.delivery_tag)
            return

        resolved_path = resolve_file_path(file_path)
        logger.info(f"Resolved ECG file path: {resolved_path}")
        
        # Connect to DB
        db_conn = get_db_connection()
        
        # 1. Update ECGRecord status to "processing"
        with db_conn.cursor() as cur:
            cur.execute(
                "UPDATE ecg_records SET processing_status = 'processing' WHERE id = %s",
                (record_id,)
            )
        db_conn.commit()
        logger.info(f"Updated record {record_id} status to 'processing'")
        
        # 2. Run Pan-Tompkins and HRV calculations
        metrics = process_ecg_file(resolved_path, fs)
        
        # 3. Save to ecg_analyses
        analysis_json = json.dumps(metrics)
        analyzed_at = time.strftime('%Y-%m-%d %H:%M:%S')
        
        with db_conn.cursor() as cur:
            # Check if analysis already exists (upsert)
            cur.execute("SELECT id FROM ecg_analyses WHERE ecg_record_id = %s", (record_id,))
            exists = cur.fetchone()
            
            if exists:
                cur.execute("""
                    UPDATE ecg_analyses 
                    SET heart_rate_mean = %s, heart_rate_min = %s, heart_rate_max = %s,
                        sdnn = %s, rmssd = %s, pnn50 = %s, r_peaks_count = %s,
                        hrv_interpretation = %s, analysis_json = %s, analyzed_at = %s
                    WHERE ecg_record_id = %s
                """, (
                    metrics["heart_rate_mean"], metrics["heart_rate_min"], metrics["heart_rate_max"],
                    metrics["sdnn"], metrics["rmssd"], metrics["pnn50"], metrics["r_peaks_count"],
                    metrics["interpretation"], analysis_json, analyzed_at, record_id
                ))
            else:
                cur.execute("""
                    INSERT INTO ecg_analyses (
                        ecg_record_id, heart_rate_mean, heart_rate_min, heart_rate_max,
                        sdnn, rmssd, pnn50, r_peaks_count, hrv_interpretation,
                        analysis_json, analyzed_at
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """, (
                    record_id, metrics["heart_rate_mean"], metrics["heart_rate_min"], metrics["heart_rate_max"],
                    metrics["sdnn"], metrics["rmssd"], metrics["pnn50"], metrics["r_peaks_count"],
                    metrics["interpretation"], analysis_json, analyzed_at
                ))
        
        # 4. Update ECGRecord status to "done"
        with db_conn.cursor() as cur:
            cur.execute(
                "UPDATE ecg_records SET processing_status = 'done' WHERE id = %s",
                (record_id,)
            )
        db_conn.commit()
        logger.info(f"Analysis completed and saved for record {record_id}.")
        
        # Acknowledge the message
        ch.basic_ack(delivery_tag=method.delivery_tag)
        
        # 5. Notify the Go backend to trigger WebSockets broadcast
        notify_backend(record_id)
        
    except Exception as e:
        logger.error(f"Error processing ECG record: {e}", exc_info=True)
        # Update ECGRecord status to "failed"
        if db_conn:
            try:
                with db_conn.cursor() as cur:
                    cur.execute(
                        "UPDATE ecg_records SET processing_status = 'failed' WHERE id = %s",
                        (record_id,)
                    )
                db_conn.commit()
                logger.info(f"Updated record {record_id} status to 'failed'")
            except Exception as db_err:
                logger.error(f"Failed to update database status to failed: {db_err}")
                
        # Acknowledge message anyway to avoid infinite loops, or reject
        ch.basic_ack(delivery_tag=method.delivery_tag)
    finally:
        if db_conn:
            db_conn.close()

def main():
    logger.info("Initializing Python ECG Processing Microservice...")
    
    # Connection retry loop for RabbitMQ
    connection = None
    channel = None
    retry_delay = 5
    
    while True:
        try:
            logger.info(f"Connecting to RabbitMQ broker at {RABBITMQ_URL}...")
            # Use pika's URLParameters
            params = pika.URLParameters(RABBITMQ_URL)
            connection = pika.BlockingConnection(params)
            channel = connection.channel()
            
            # Declare the queue (must match backend definition)
            channel.queue_declare(queue='ecg_processing', durable=True)
            break
        except Exception as e:
            logger.warning(f"Failed to connect to RabbitMQ: {e}. Retrying in {retry_delay} seconds...")
            time.sleep(retry_delay)
            
    logger.info("Successfully connected to RabbitMQ. Waiting for messages on queue 'ecg_processing'...")
    
    channel.basic_qos(prefetch_count=1)
    channel.basic_consume(queue='ecg_processing', on_message_callback=process_message)
    
    try:
        channel.start_consuming()
    except KeyboardInterrupt:
        logger.info("Service shutting down...")
        channel.stop_consuming()
        connection.close()

if __name__ == "__main__":
    main()
