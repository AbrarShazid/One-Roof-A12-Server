const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { MongoClient, ServerApiVersion } = require("mongodb");

// load environment variable from .env

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@shazid.sdvbyar.mongodb.net/?retryWrites=true&w=majority&appName=Shazid`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const db = client.db("buildingDB");
    const usersCollection = db.collection("users");
    const apartmentsCollection = db.collection("apartments");
    const agreementsCollection = db.collection("agreements");
    const announcementCollection = db.collection("announcements");

    // user add while registration
    app.post("/users", async (req, res) => {
      try {
        const user = req.body;
        const query = { email: user.email };
        const existing = await usersCollection.findOne(query);
        if (existing) {
          return res.status(200).send({ message: "User already exists" });
        }
        const result = await usersCollection.insertOne(user);
        res.status(201).send(result);
      } catch (err) {
        res.status(500).send({ error: err.message });
      }
    });

    // user role fetch for dashboard
    app.get("/users/:email/role", async (req, res) => {
      try {
        const email = req.params.email;

        if (!email) {
          return res.status(400).send({ message: "Email is required" });
        }

        const user = await usersCollection.findOne({ email });

        if (!user) {
          return res.status(404).send({ message: "User not found" });
        }

        res.send({ role: user.role || "user" });
      } catch (error) {
        console.error("Error getting user role:", error);
        res.status(500).send({ message: "Failed to get role" });
      }
    });

    // apartments data

    app.get("/apartments", async (req, res) => {
      const page = parseInt(req.query.page) || 1;
      const limit = 6;
      const skip = (page - 1) * limit;

      const minRent = parseInt(req.query.minRent) || 0;
      const maxRent = parseInt(req.query.maxRent) || Infinity;

      const query = {
        rent: { $gte: minRent, $lte: maxRent },
        isAvailable: true,
      };

      const total = await apartmentsCollection.countDocuments(query);
      const apartments = await apartmentsCollection
        .find(query)
        .skip(skip)
        .limit(limit)
        .toArray();

      res.send({
        total,
        page,
        totalPages: Math.ceil(total / limit),
        apartments,
      });
    });

    // POST agreement
    app.post("/agreements", async (req, res) => {
      const { userName, userEmail, floor, block, apartmentNo, rent } = req.body;

      const exists = await agreementsCollection.findOne({ userEmail });
      if (exists) {
        return res
          .status(400)
          .send({ message: "User already applied for an apartment" });
      }

      const agreement = {
        userName,
        userEmail,
        floor,
        block,
        apartmentNo,
        rent,
        status: "pending",
        createdDate: new Date(),
      };

      const result = await agreementsCollection.insertOne(agreement);
      res.send(result);
    });

    // announcement section

    app.post("/announcement", async (req, res) => {
      try {
        const announcement = req.body;
        announcement.createdAt = new Date();
        const result = await announcementCollection.insertOne(announcement);
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Internal server error" });
      }
    });



    app.get('/announcement', async (req, res) => {
      try {
        const announcements = await announcementCollection
          .find()
          .sort({ createdAt: -1 }) // Sort by newest first
          .toArray();
    
        res.send(announcements);
      } catch (error) {
        
        res.status(500).send({ error: 'Failed to fetch announcements' });
      }
    });


















    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Building Management server running");
});

app.listen(port, () => {
  console.log(`server is listening on port ${port}`);
});
