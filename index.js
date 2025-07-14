const express = require("express");
const cors=require("cors");
const dotenv=require("dotenv");
const { MongoClient, ServerApiVersion } = require('mongodb');


// load environment variable from .env  

dotenv.config();

const app=express();
const port=process.env.PORT || 5000

app.use(cors());
app.use(express.json());







const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@shazid.sdvbyar.mongodb.net/?retryWrites=true&w=majority&appName=Shazid`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();


    
    const db = client.db("buildingDB");
    const usersCollection = db.collection("users");






    app.post("/api/users", async (req, res) => {
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















    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);







app.get('/',(req,res)=>{

  res.send('Building Management server running');
})

app.listen(port,()=>{
  console.log(`server is listening on port ${port}`)
})
