-- ============================================================
-- Food Delivery Platform — MySQL Schema
-- ============================================================

CREATE DATABASE IF NOT EXISTS food_delivery CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE food_delivery;

-- ------------------------------------------------------------
-- Users (all roles share this table)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(100)  NOT NULL,
    email       VARCHAR(150)  UNIQUE NOT NULL,
    password    VARCHAR(255)  NOT NULL,
    phone       VARCHAR(20),
    role        ENUM('customer','restaurant_owner','rider') NOT NULL DEFAULT 'customer',
    avatar_url  VARCHAR(500),
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------
-- Food Categories
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categories (
    id    INT AUTO_INCREMENT PRIMARY KEY,
    name  VARCHAR(100) NOT NULL,
    icon  VARCHAR(10)  NOT NULL DEFAULT '🍽️'
);

-- ------------------------------------------------------------
-- Restaurants
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS restaurants (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    owner_id      INT          NOT NULL,
    name          VARCHAR(150) NOT NULL,
    cuisine_type  VARCHAR(100),
    description   TEXT,
    image_url     VARCHAR(500),
    address       TEXT,
    city          VARCHAR(100) DEFAULT 'City',
    rating        DECIMAL(2,1) DEFAULT 0.0,
    review_count  INT          DEFAULT 0,
    delivery_time INT          DEFAULT 30,    -- minutes
    delivery_fee  DECIMAL(8,2) DEFAULT 30.00,
    min_order     DECIMAL(8,2) DEFAULT 0.00,
    is_open       TINYINT(1)   DEFAULT 1,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ------------------------------------------------------------
-- Menu Items
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS menu_items (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    restaurant_id INT          NOT NULL,
    category_id   INT,
    name          VARCHAR(150) NOT NULL,
    description   TEXT,
    price         DECIMAL(8,2) NOT NULL,
    image_url     VARCHAR(500),
    is_veg        TINYINT(1)   DEFAULT 0,
    is_available  TINYINT(1)   DEFAULT 1,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id)   REFERENCES categories(id) ON DELETE SET NULL
);

-- ------------------------------------------------------------
-- Riders
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS riders (
    id               INT AUTO_INCREMENT PRIMARY KEY,
    user_id          INT         NOT NULL UNIQUE,
    vehicle_type     ENUM('bicycle','motorcycle','scooter','car') DEFAULT 'motorcycle',
    vehicle_number   VARCHAR(50),
    is_available     TINYINT(1)  DEFAULT 1,
    total_earnings   DECIMAL(10,2) DEFAULT 0.00,
    deliveries_count INT          DEFAULT 0,
    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ------------------------------------------------------------
-- Customer Addresses
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS addresses (
    id       INT AUTO_INCREMENT PRIMARY KEY,
    user_id  INT         NOT NULL,
    label    VARCHAR(50) DEFAULT 'Home',
    street   TEXT        NOT NULL,
    city     VARCHAR(100),
    pincode  VARCHAR(10),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ------------------------------------------------------------
-- Orders
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS orders (
    id                  INT AUTO_INCREMENT PRIMARY KEY,
    customer_id         INT         NOT NULL,
    restaurant_id       INT         NOT NULL,
    rider_id            INT         DEFAULT NULL,
    status              ENUM('placed','accepted','preparing','ready','out_for_delivery','delivered','cancelled')
                        NOT NULL DEFAULT 'placed',
    total_amount        DECIMAL(10,2) NOT NULL,
    delivery_fee        DECIMAL(8,2)  DEFAULT 30.00,
    delivery_address    TEXT,
    special_instructions TEXT,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id)   REFERENCES users(id),
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id),
    FOREIGN KEY (rider_id)      REFERENCES riders(id) ON DELETE SET NULL
);

-- ------------------------------------------------------------
-- Order Items (snapshot of price at time of order)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS order_items (
    id             INT AUTO_INCREMENT PRIMARY KEY,
    order_id       INT          NOT NULL,
    menu_item_id   INT          NOT NULL,
    item_name      VARCHAR(150) NOT NULL,  -- snapshot
    quantity       INT          NOT NULL DEFAULT 1,
    price_at_time  DECIMAL(8,2) NOT NULL,  -- snapshot
    is_veg         TINYINT(1)   DEFAULT 0,
    FOREIGN KEY (order_id)     REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (menu_item_id) REFERENCES menu_items(id)
);

-- ------------------------------------------------------------
-- Reviews
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reviews (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    customer_id   INT NOT NULL,
    restaurant_id INT NOT NULL,
    order_id      INT DEFAULT NULL,
    rating        INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment       TEXT,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id)   REFERENCES users(id),
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id),
    FOREIGN KEY (order_id)      REFERENCES orders(id) ON DELETE SET NULL
);
