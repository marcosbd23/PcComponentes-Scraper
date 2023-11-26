const mysql = require('mysql2');
const config = require("../config")

const connection = mysql.createConnection({
    host: config.db.host,
    user: config.db.user,
    password: config.db.password,
    database: config.db.database
});

const Database = {

    connect() {
        return new Promise((resolve, reject) => {
            connection.connect((err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    },

    getProductInfo(productID) {
        return new Promise((resolve, reject) => {
            const selectQuery = 'SELECT * FROM products WHERE id = ?';

            connection.query(selectQuery, [productID], (err, results) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(results.length > 0 ? results[0] : null);
                }
            });
        });
    },

    insertProduct({id, name, url, vendor, brand, stock, price}) {
        return new Promise((resolve, reject) => {
            const insertQuery = 'INSERT INTO products (id, name, url, vendor, brand, stock, price, lowest_price) VALUES (?, ?, ?, ?, ?, ?, ?, ?)';

            connection.query(insertQuery, [id, name, url, vendor, brand, stock, price, price], (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    },

    insertChange({type, product_id, oldInfo, newInfo}) {
        return new Promise((resolve, reject) => {
            const insertQuery = 'INSERT INTO changes (product_id, type, old, new) VALUES (?, ?, ?, ?)';

            connection.query(insertQuery, [product_id, type, oldInfo, newInfo], (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    },

    updateProduct({id, name, stock, vendor, brand, price, lowest_price}) {
        return new Promise((resolve, reject) => {
            const updateQuery = 'UPDATE products SET name = ?, stock = ?, vendor = ?, brand = ?, price = ?, lowest_price = ? WHERE id = ?';

            connection.query(updateQuery, [name, stock, vendor, brand, price, lowest_price, id], (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    },

    close() {
        connection.end();
    }
};


module.exports = Database;