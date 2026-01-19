DROP DATABASE IF EXISTS scheduling_app;
CREATE DATABASE scheduling_app;
USE scheduling_app;

DROP TABLE IF EXISTS deliveries_table;
DROP TABLE IF EXISTS user_table;
DROP TABLE IF EXISTS customer_info;

CREATE TABLE user_table (
	user_id INT AUTO_INCREMENT PRIMARY KEY,
    last_name VARCHAR(100) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    user_email VARCHAR(50) UNIQUE NOT NULL,
    role ENUM('scheduler', 'driver', 'admin') NOT NULL DEFAULT 'scheduler',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE customer_info (
    cust_id INT AUTO_INCREMENT PRIMARY KEY,
    last_name VARCHAR(100) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    cust_email VARCHAR(50) NOT NULL,
    cust_phone VARCHAR(14),
    cust_address VARCHAR(100) NOT NULL,
    cust_city VARCHAR(50) NOT NULL,
    cust_zip VARCHAR(10) NOT NULL
);

CREATE TABLE deliveries_table (
    deliv_id INT AUTO_INCREMENT PRIMARY KEY,
    del_address VARCHAR(100) NOT NULL,
    del_city VARCHAR(50) NOT NULL,
    del_zip VARCHAR(10) NOT NULL,
    scheduled_time DATETIME NOT NULL,
    deliv_status ENUM('pending', 'assigned', 'in_progress', 'completed', 'cancelled') NOT NULL DEFAULT 'pending',
    notes TEXT,
    cust_id INT,
    user_id INT,
    completed_at DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (cust_id) REFERENCES customer_info(cust_id),
    FOREIGN KEY (user_id) REFERENCES user_table(user_id)
);