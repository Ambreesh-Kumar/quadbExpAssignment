const express = require("express");
const app = express();
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const dbPath = path.join(__dirname, "user.db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

let db = null;
app.use(express.json());

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(4000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};

initializeDBAndServer();

// middleware function

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

/// resister api

app.post("/users/", async (request, response) => {
  const { username, name, password, gender, location } = request.body;
  const hashedPassword = await bcrypt.hash(request.body.password, 10);
  const selectUserQuery = `SELECT * FROM registration WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    const createUserQuery = `
      INSERT INTO 
        registration (username, name, password, gender, location) 
      VALUES 
        (
          '${username}', 
          '${name}',
          '${hashedPassword}', 
          '${gender}',
          '${location}'
        )`;
    const dbResponse = await db.run(createUserQuery);
    const newUserId = dbResponse.lastID;
    response.send(`Created new user with ${newUserId}`);
  } else {
    response.status = 400;
    response.send("User already exists");
  }
});

/// login api

app.post("/login", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM registration WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid User");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid Password");
    }
  }
});

// get user details api

app.get("/details/:userId/", authenticateToken, async (request, response) => {
  const { userId } = request.params;
  const getDetailsQuery = `
   SELECT
    *
   FROM
    users
   WHERE 
    user_id = ${userId};`;
  const details = await db.get(getDetailsQuery);
  response.send(details);
});

// add details

app.post("/insert", authenticateToken, async (request, response) => {
  const userDetails = request.body;
  const {
    user_name,
    user_email,
    user_password,
    user_image,
    total_orders,
    created_at,
    last_logged_in,
  } = userDetails;
  const addUserDetailsQuery = `
    INSERT INTO
      users (user_name, user_email, user_password, user_image, total_orders, created_at, last_logged_in)
    VALUES
      (
        '${user_name}',
        '${user_email}',
        '${user_password}',
        '${user_image}',
        ${total_orders},
        '${created_at}',
        '${last_logged_in}'
      );`;

  try {
    const dbResponse = await db.run(addUserDetailsQuery);
    const userId = dbResponse.lastID;
    response.send("User added successfully");
  } catch (error) {
    console.error("Error adding user:", error.message);
    response.status(500).send("Error adding user");
  }
});
/// update api

app.put("/update/:userId", authenticateToken, async (request, response) => {
  const userId = request.params.userId;
  const updatedUserData = request.body;
  const {
    user_name,
    user_email,
    user_password,
    user_image,
    total_orders,
    created_at,
    last_logged_in,
  } = updatedUserData;

  const updateUserQuery = `
    UPDATE users
    SET
      user_name = '${user_name}',
      user_email = '${user_email}',
      user_password = '${user_password}',
      user_image = '${user_image}',
      total_orders = ${total_orders},
      created_at = '${created_at}',
      last_logged_in = '${last_logged_in}'
    WHERE user_id = ${userId}`;

  try {
    await db.run(updateUserQuery);
    response.send(`User with ID ${userId} updated successfully`);
  } catch (error) {
    console.error("Error updating user:", error.message);
    response.status(500).send("Error updating user");
  }
});

/// get image of user

app.get("/image/:userId/", authenticateToken, async (request, response) => {
  const { userId } = request.params;
  const getImageQuery = `
   SELECT
    user_image
   FROM
    users
   WHERE 
    user_id = ${userId};`;
  const imageDetail = await db.get(getImageQuery);
  response.send(imageDetail);
});

/// delete api

app.delete("/delete/:userId", async (request, response) => {
  const userId = request.params.userId;
  const deleteUserQuery = `DELETE FROM users WHERE user_id = ${userId}`;

  try {
    const dbResponse = await db.run(deleteUserQuery);
    if (dbResponse.changes === 1) {
      response.send(`User with ID ${userId} deleted successfully`);
    } else {
      response.status(404).send(`User with ID ${userId} not found`);
    }
  } catch (error) {
    response.status(500).send("Internal Server Error");
  }
});
