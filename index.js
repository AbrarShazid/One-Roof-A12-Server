const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

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
    const couponCollection = db.collection("coupons");

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
        res.status(500).send({ message: "Failed to get role" });
      }
    });

    // user fetch for member profile
    app.get("/user/:email", async (req, res) => {
      try {
        const email = req.params.email;

        const user = await usersCollection.findOne({ email });
        if (!user) {
          return res.status(404).send({ message: "User not found" });
        }

        res.send(user);
      } catch (error) {
        res.status(500).send({ message: "Failed to get user" });
      }
    });

    // GET all members
    app.get("/users/members", async (req, res) => {
      try {
        const members = await usersCollection
          .find({ role: "member" })
          .toArray();
        res.send(members);
      } catch (error) {
        res.status(500).send({ message: "Failed to fetch members" });
      }
    });

    // manage member by admin

    app.patch("/users/remove-member/:email", async (req, res) => {
      try {
        const email = req.params.email;

        // Find  user
        const user = await usersCollection.findOne({ email });

        // Update apartment availability
        await apartmentsCollection.updateOne(
          { apartmentNo: user.apartmentNo },
          { $set: { isAvailable: true } }
        );

        // Reset user role to 'user' and remove apartment-related fields
        await usersCollection.updateOne(
          { email },
          {
            $set: { role: "user" },
            $unset: {
              agreementAt: "",
              apartmentNo: "",
              block: "",
              floor: "",
              rent: "",
            },
          }
        );
        await agreementsCollection.deleteOne({ userEmail: email });

        res.send({ message: "Member removed successfully" });
      } catch (error) {
        res.status(500).send({ message: "Failed to remove member" });
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
      const { userName, userEmail, userImg, floor, block, apartmentNo, rent } =
        req.body;

      const user = await usersCollection.findOne({ email: userEmail });
      if (user?.role === "member" || user?.role === "admin") {
        return res
          .status(400)
          .send({
            message: `${userName}, you are ${
              user.role === "admin" ? "an admin" : "already a member"
            }`,
          });
      }

      const exists = await agreementsCollection.findOne({ userEmail });

      if (exists) {
        return res
          .status(400)
          .send({ message: `${userName} already applied for an apartment` });
      }

      const agreement = {
        userName,
        userEmail,
        userImg,
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

    // get agreement
    app.get("/agreements", async (req, res) => {
      const status = req.query.status;
      const result = await agreementsCollection.find({ status }).toArray();
      res.send(result);
    });

    // update agreement based on accept or reject with logic of availability etc
    // Accept agreement:
    app.patch("/agreements/accept/:id", async (req, res) => {
      try {
        const agreementId = req.params.id;
        const agreement = await agreementsCollection.findOne({
          _id: new ObjectId(agreementId),
        });

        if (!agreement) {
          return res.status(404).send({ message: "Agreement not found" });
        }

        // Checkk  availability
        const apartment = await apartmentsCollection.findOne({
          apartmentNo: agreement.apartmentNo,
        });
        if (!apartment || !apartment.isAvailable) {
          return res
            .status(400)
            .send({ message: "Apartment is not available" });
        }

        // Update user with full  info
        await usersCollection.updateOne(
          { email: agreement.userEmail },
          {
            $set: {
              role: "member",
              apartmentNo: agreement.apartmentNo,
              block: agreement.block,
              floor: agreement.floor,
              rent: parseInt(agreement.rent),
              agreementAt: new Date(),
            },
          }
        );

        // Mark  unavailable
        await apartmentsCollection.updateOne(
          { apartmentNo: agreement.apartmentNo },
          { $set: { isAvailable: false } }
        );

        // Update  status
        await agreementsCollection.updateOne(
          { _id: new ObjectId(agreementId) },
          { $set: { status: "checked" } }
        );

        res.send({ message: "Agreement accepted successfully" });
      } catch (error) {
        res.status(500).send({ message: "Internal server error" });
      }
    });

    // Reject agreement:
    app.patch("/agreements/reject/:id", async (req, res) => {
      try {
        const agreementId = req.params.id;

        const agreement = await agreementsCollection.findOne({
          _id: new ObjectId(agreementId),
        });
        if (!agreement) {
          return res.status(404).send({ message: "Agreement not found" });
        }

        await agreementsCollection.updateOne(
          { _id: new ObjectId(agreementId) },
          { $set: { status: "checked" } }
        );

        res.send({ message: "Agreement rejected successfully" });
      } catch (error) {
        res.status(500).send({ message: "Internal server error" });
      }
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

    // announcement fetch

    app.get("/announcement", async (req, res) => {
      try {
        const announcements = await announcementCollection
          .find()
          .sort({ createdAt: -1 }) // Sort by newest first
          .toArray();

        res.send(announcements);
      } catch (error) {
        res.status(500).send({ error: "Failed to fetch announcements" });
      }
    });



    // ---------------Coupons---------------------------------

    // coupon post 

    app.post('/coupons', async (req, res) => {
      try {
        const { code, discount, description } = req.body;
        const parsedDiscount = parseFloat(discount);
        // Check  duplicate code
        const exists = await couponCollection.findOne({ code });
        if (exists) {
          return res.status(409).send({ message: 'Coupon code already exists' });
        }
    
        const newCoupon = {
          code,
          discount: parsedDiscount,
          description,
          createdAt: new Date(),
          isAvailable:true
        };
    
        const result = await couponCollection.insertOne(newCoupon);
        res.status(201).send(result);
      } catch (err) {
        res.status(500).send({ message: 'Failed to create coupon', error: err.message });
      }
    });
    
    // Get all coupons
    app.get('/coupons', async (req, res) => {
      try {
        const coupons = await couponCollection.find().sort({ createdAt: -1 }).toArray();
        res.send(coupons);
      } catch (err) {
        res.status(500).send({ message: 'Failed to fetch coupons', error: err.message });
      }
    });
    
    // update coupon availability 
    app.patch('/coupons/:id', async (req, res) => {
      try {
        const id = req.params.id;
        const { isAvailable } = req.body;
    
        const result = await couponCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { isAvailable: isAvailable } }
        );
    
        if (result.matchedCount === 0) {
          return res.status(404).send({ message: 'Coupon not found' });
        }
    
        res.send({ message: 'Coupon availability updated' });
      } catch (err) {
        res.status(500).send({ message: 'Failed to update coupon', error: err.message });
      }
    });















// admin profile for all data summary 

    app.get('/admin/summary', async (req, res) => {
      try {
        const totalUsers = await usersCollection.countDocuments({ role: { $ne: 'admin' } });
        const totalMembers = await usersCollection.countDocuments({ role: 'member' });
    
        const totalRooms = await apartmentsCollection.countDocuments();
        const availableRooms = await apartmentsCollection.countDocuments({ isAvailable: true });
        const admin = await usersCollection.findOne({ role: 'admin' });
    
        res.send({
          admin: {
            name: admin?.name,
            email: admin?.email,
            image: admin?.photo,
          },
          totalUsers,
          totalMembers,
          totalRooms,
          availableRooms,
          agreementPercentage: totalUsers > 0 ? ((totalMembers / totalUsers) * 100).toFixed(1) : '0',
          availablePercentage: totalRooms > 0 ? ((availableRooms / totalRooms) * 100).toFixed(1) : '0',
        });
      } catch (error) {
        res.status(500).send({ message: 'Failed to fetch admin dashboard summary', error: error.message });
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
