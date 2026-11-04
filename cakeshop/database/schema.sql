-- ============================================================
-- Cake Shop database schema (MySQL 8 / AWS RDS MySQL compatible)
-- Run:  mysql -h <host> -u <user> -p < database/schema.sql
-- ============================================================

CREATE DATABASE IF NOT EXISTS cakeshop_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE cakeshop_db;

-- Drop in child -> parent order so the script can be re-run safely
DROP TABLE IF EXISTS order_items;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS cakes;
DROP TABLE IF EXISTS users;

-- ---------------------------------------------------------------
-- users
-- ---------------------------------------------------------------
CREATE TABLE users (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  full_name     VARCHAR(100) NOT NULL,
  email         VARCHAR(150) NOT NULL,
  phone         VARCHAR(20)  NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role          ENUM('customer','admin') NOT NULL DEFAULT 'customer',
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------
-- cakes
-- ---------------------------------------------------------------
CREATE TABLE cakes (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name         VARCHAR(120) NOT NULL,
  description  TEXT NOT NULL,
  category     VARCHAR(50)  NOT NULL DEFAULT 'Classic',
  price        DECIMAL(10,2) NOT NULL,
  image_url    VARCHAR(500) NULL,
  is_featured  TINYINT(1) NOT NULL DEFAULT 0,
  is_available TINYINT(1) NOT NULL DEFAULT 1,
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_cakes_name (name),
  KEY idx_cakes_category (category),
  CONSTRAINT chk_cakes_price CHECK (price >= 0)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------
-- orders  (references users)
-- ---------------------------------------------------------------
CREATE TABLE orders (
  id               INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id          INT UNSIGNED NOT NULL,
  total_amount     DECIMAL(10,2) NOT NULL,
  status           ENUM('Pending','Confirmed','Preparing','Out for Delivery','Delivered','Cancelled')
                   NOT NULL DEFAULT 'Pending',
  delivery_address VARCHAR(500) NOT NULL,
  contact_phone    VARCHAR(20)  NOT NULL,
  notes            VARCHAR(500) NULL,
  created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_orders_user (user_id),
  KEY idx_orders_status (status),
  CONSTRAINT fk_orders_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------
-- order_items  (references orders and cakes)
-- unit_price is copied at order time so later price edits never change history
-- ---------------------------------------------------------------
CREATE TABLE order_items (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id   INT UNSIGNED NOT NULL,
  cake_id    INT UNSIGNED NOT NULL,
  quantity   INT UNSIGNED NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_order_cake (order_id, cake_id),
  KEY idx_items_cake (cake_id),
  CONSTRAINT fk_items_order
    FOREIGN KEY (order_id) REFERENCES orders(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_items_cake
    FOREIGN KEY (cake_id) REFERENCES cakes(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT chk_items_qty CHECK (quantity > 0)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------
-- Sample data: cakes
-- (Sample users and orders are created by `npm run seed` because
--  passwords must be hashed with bcrypt, never stored as plain text.)
-- ---------------------------------------------------------------
INSERT INTO cakes (name, description, category, price, image_url, is_featured) VALUES
('Chocolate Truffle',   'Rich dark chocolate sponge layered with silky truffle ganache.',            'Chocolate',  650.00, 'https://placehold.co/600x450/f6d5da/7a3b4b?text=Chocolate+Truffle', 1),
('Red Velvet',          'Velvety red sponge with cream cheese frosting and white chocolate curls.',  'Classic',    720.00, 'https://placehold.co/600x450/f6d5da/7a3b4b?text=Red+Velvet', 1),
('Black Forest',        'Chocolate sponge, whipped cream and cherries with dark chocolate shavings.', 'Chocolate',  600.00, 'https://placehold.co/600x450/f6d5da/7a3b4b?text=Black+Forest', 1),
('Strawberry Delight',  'Light vanilla sponge with fresh strawberries and strawberry cream.',        'Fruit',      680.00, 'https://placehold.co/600x450/f6d5da/7a3b4b?text=Strawberry+Delight', 1),
('Butterscotch Crunch', 'Butterscotch cream with crunchy caramelised praline on top.',               'Classic',    620.00, 'https://placehold.co/600x450/f6d5da/7a3b4b?text=Butterscotch', 0),
('Pineapple Cake',      'Soft sponge with juicy pineapple pieces and fresh whipped cream.',          'Fruit',      560.00, 'https://placehold.co/600x450/f6d5da/7a3b4b?text=Pineapple', 0),
('Blueberry Cheesecake','Creamy baked cheesecake on a buttery biscuit base with blueberry compote.', 'Cheesecake', 850.00, 'https://placehold.co/600x450/f6d5da/7a3b4b?text=Blueberry+Cheesecake', 1),
('Mango Mousse Cake',   'Alphonso mango mousse on a soft sponge base. A summer favourite.',          'Fruit',      780.00, 'https://placehold.co/600x450/f6d5da/7a3b4b?text=Mango+Mousse', 0),
('Vanilla Bean',        'Classic vanilla bean sponge with buttercream rosettes.',                    'Classic',    500.00, 'https://placehold.co/600x450/f6d5da/7a3b4b?text=Vanilla+Bean', 0),
('Death by Chocolate',  'Five layers of chocolate: sponge, mousse, ganache, brownie and glaze.',    'Chocolate',  900.00, 'https://placehold.co/600x450/f6d5da/7a3b4b?text=Death+by+Chocolate', 0);
