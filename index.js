const express =  require('express')
const bodyParser = require('body-parser')
const cors = require('cors')
const {open} = require('sqlite')
const sqlite3 = require('sqlite3')
const path = require('path')
const {v4} = require('uuid')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')

const app = express();

const port = process.env.PORT || 5000;
const dbPath = path.join(__dirname, "money_manager.db")
let database = null

app.use(bodyParser.json());
app.use(cors());

const initializeDBANDServer = async () => {
    try {
        database = await open({
            filename: dbPath,
            driver: sqlite3.Database
        })
        app.listen(port, () => console.log(`Server Running at http://localhost:${port}`))
    } catch (error) {
        console.log(`DB Error: ${error}`)
        process.exit(1)
    }
}
initializeDBANDServer()

app.get("/", (request, response) => response.send(JSON.stringify("Hello Money Manager App")))

app.post("/signup", async (request, response) => {
    const {username, password, name, gender, dob, email, mobile} = request.body
    const getUserQuery = `SELECT * FROM users WHERE username='${username}'`
    const user = await database.get(getUserQuery)
    if (user === undefined) {
        const encryptPassword = await bcrypt.hash(password, 5)
        const createUserQuery = `INSERT INTO users (username, password, name, gender, dob, email, mobile) VALUES ('${username}', '${encryptPassword}', '${name}', '${gender}', '${dob}', '${email}', '${mobile}')`    
        await database.run(createUserQuery)
        response.send({success_msg: "User created successfully"})
    } else {
        response.status(400)
        response.send({error_msg: "Username already exits"})
    }
})

app.post("/login", async (request, response) => {
    const {username, password} = request.body
    const getUserQuery = `SELECT * FROM users WHERE username='${username}'`
    const user = await database.get(getUserQuery)
    if (user === undefined) {
        response.status(400)
        response.send({error_msg: "Invalid User"})
    } else {
        const isPasswordMatched = await bcrypt.compare(password, user.password)
        if (isPasswordMatched) {
            const payload = {username}
            const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN")
            response.send({jwt_token: jwtToken})
        } else {
            response.status(400)
            response.send({error_msg: "Invalid Password"})
        }
    }
})

const authenticateToken = (request, response, next) => {
    let jwtToken;
    const authHeader = request.headers["authorization"];
    if (authHeader !== undefined) {
        jwtToken = authHeader.split(" ")[1];
    }
    if (jwtToken === undefined) {
        response.status(401);
        response.send({error_msg: "JWT Token is doesn't exits"})
    } else {
        jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
            if (error) {
                response.status(401)
                response.send({error_msg: "Invalid JWT Token"})
            } else {
                request.username = payload.username
                next()
            }
        });
    }
};

// app.get("/users", authenticateToken, async (request, response) => {
//     const getUsersQuery = `SELECT * FROM users`
//     const users = await database.all(getUsersQuery)
//     response.send(users)
// })

app.get("/transactions", authenticateToken, async (request, response) => {
    const {username} = request
    const getUserTransactionsQuery = `SELECT * FROM transactions WHERE username='${username}';`
    const transactions = await database.all(getUserTransactionsQuery)
    response.send(transactions)
})

app.post("/transactions", authenticateToken, async (request, response) => {
    const {username} = request
    const {type, title, amount} = request.body
    const createUserTransactionQuery = `INSERT INTO transactions (transaction_id, username, type, title, amount) VALUES ('${v4()}', '${username}', '${type}', '${title}', '${amount}');`
    await database.run(createUserTransactionQuery)
    response.send({success_msg: "Transaction added Successfully"})
})

app.put("/transactions/:transactionId", authenticateToken, async (request, response) => {
    const {transactionId} = request.params
    const {type, title, amount} = request.body
    const createUserTransactionQuery = `UPDATE transactions SET type='${type}', title='${title}', amount='${amount}' WHERE transaction_id='${transactionId}';`
    await database.run(createUserTransactionQuery)
    response.send({success_msg: "Transaction Updated Successfully"})
})

app.delete("/transactions/:transactionId", authenticateToken, async (request, response) => {
    const {transactionId} = request.params
    const createUserTransactionQuery = `DELETE FROM transactions WHERE transaction_id='${transactionId}';`
    await database.run(createUserTransactionQuery)
    response.send({success_msg: "Transaction Deleted Successfully"})
})