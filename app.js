const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
const app = express();
app.use(express.json());

let db;
const initializationDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server is Running at http://localhost:3000");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};

initializationDBAndServer();

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  console.log(jwtToken);
  if (jwtToken === undefined) {
    response.sendStatus(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.sendStatus(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

// API 1 USER LOGIN
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `
    SELECT * FROM user WHERE username = '${username}';
    `;
  const dbUser = await db.get(selectUserQuery);
  console.log(dbUser);
  if (dbUser === undefined) {
    //If an unregistered user tries to login
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    console.log(isPasswordMatched);
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      // Successful login of the user
      response.send({ jwtToken });
    } else {
      //If the user provides an incorrect password
      response.status(400);
      response.send("Invalid password");
    }
  }
});

// API 2 GET METHOD Returns a list of all states in the state table
const convertCamelCaseNotationToPascalCase = (dbObject) => {
  return {
    stateId: dbObject.state_id,
    stateName: dbObject.state_name,
    population: dbObject.population,
  };
};

app.get("/states", authenticateToken, async (request, response) => {
  const getStatesQuery = `
        SELECT * FROM state;`;
  const listOfStates = await db.all(getStatesQuery);
  response.send(
    listOfStates.map((eachState) => {
      return convertCamelCaseNotationToPascalCase(eachState);
    })
  );
});

// API 3 GET METHOD Returns a state based on the state ID
app.get("/states/:stateId/", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const getStatesQuery = `
    SELECT * FROM state WHERE state_id = ${stateId};`;
  const stateDetails = await db.get(getStatesQuery);
  response.send(convertCamelCaseNotationToPascalCase(stateDetails));
});

// API 4 Create a district in the district table, district_id is auto-incremented
app.post("/districts/", authenticateToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const postDistrictDetailsQuery = `
    INSERT INTO district(district_name, state_id, cases, cured, active, deaths)
    VALUES(
        '${districtName}',
        ${stateId},
        ${cases},
        ${cured},
        ${active},
        ${deaths}
    );
    `;
  await db.run(postDistrictDetailsQuery);
  response.send("District Successfully Added");
});

// API 5 Returns a district based on the district ID
app.get(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrictDetailsQuery = `
    SELECT * FROM district WHERE district_id = ${districtId};
    `;
    const getDistrictDetails = await db.get(getDistrictDetailsQuery);
    response.send({
      districtId: getDistrictDetails["district_id"],
      districtName: getDistrictDetails["district_name"],
      stateId: getDistrictDetails["state_id"],
      cases: getDistrictDetails["cases"],
      cured: getDistrictDetails["cured"],
      deaths: getDistrictDetails["deaths"],
    });
  }
);

// API 6 DELETE METHOD Deletes a district from the district table based on the district ID
app.delete(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteDistrictQuery = `
    DELETE FROM district WHERE district_id = ${districtId};`;
    await db.run(deleteDistrictQuery);
    response.send("District Removed");
  }
);

// API 7 Updates the details of a specific district based on the district ID
app.put(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const updateDistrictDetailsQuery = `
    UPDATE district
    SET 
        district_name = '${districtName}',
        state_id = ${stateId},
        cases = ${cases},
        cured = ${cured},
        active = ${active},
        deaths = ${deaths}
    WHERE district_id = ${districtId}     ;`;
    const updatedDistrict = await db.run(updateDistrictDetailsQuery);
    response.send("District Details Updated");
  }
);

module.exports = app;
