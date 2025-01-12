require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");
const morgan = require("morgan");

const port = process.env.PORT || 9000;
const app = express();
// middleware
const corsOptions = {
  origin: ["http://localhost:5173", "http://localhost:5174"],
  credentials: true,
  optionSuccessStatus: 200,
};
app.use(cors(corsOptions));

app.use(express.json());
app.use(cookieParser());
app.use(morgan("dev"));






const verifyToken = async (req, res, next) => {
  const token = req.cookies?.token;

  if (!token) {
    return res.status(401).send({ message: "unauthorized access" });
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      console.log(err);
      return res.status(401).send({ message: "unauthorized access" });
    }
    req.user = decoded;
    next();
  });
};

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.nqyrr.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

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
    const userCollection = client.db("plantNet").collection("users");
    const plantsCollection = client.db("plantNet").collection("plants");
    const ordersCollection = client.db("plantNet").collection("orders");



    const VerifyAdmin=async(req, res, next)=>{
      const email = req.user?.email
      const query = {email}
      const result = await userCollection.findOne(query)
      if(!result || result?.role !== 'Admin'){
        return res.status(401).send({Massage:'Forbidden Access'})
      }
      
      next()
    }
    const VerifySeller=async(req, res, next)=>{
      const email = req.user?.email
      const query = {email}
      const result = await userCollection.findOne(query)
      if(!result || result?.role !== 'seller'){
        return res.status(401).send({Massage:'Forbidden Access'})
      }
      
      next()
    }





    // users
    app.get("/users/:email",verifyToken,VerifyAdmin, async (req, res) => {
      const email = req.params.email
      const query = {email: {$ne:email}} // ne mane 'not equal' admin nijer id ta jake update na korte pare tai manageUser theke tar id bad e sob id lode hocche
      const result = await userCollection.find(query).toArray();
      res.send(result);
    });
    // ekhane user Become a seller dewar por ei request ashtase and database e tar datay ekta status notun vabe add hcche
    app.patch('/users/:email',verifyToken, async(req, res)=>{
      const email= req.params.email
      const filter = { email}
      const user = await userCollection.findOne(filter)
      if(!user || user.status === 'Requested'){
        return res.status(400).send('you already send request for seller')
      }
      const updateDoc = {
        $set:{
          status: 'Requested'
        }
      }
      const result = await userCollection.updateOne(filter, updateDoc) 
      res.send(result)
    })
    
    // ekhane admin dropdown er maddhome onno user er status onujai role update kore dicche
    app.patch('/user/update/role/:email',verifyToken,VerifyAdmin, async (req, res)=>{
      const email = req.params.email
      const {role, status} = req.body
      const filter = {email}
      const updatedDoc = {
        $set:{role, status:'Verified'}
      }
      const result = await userCollection.updateOne(filter, updatedDoc)
      res.send(result) 
    })
    app.post("/users/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email };
      const user = req.body;
      //
      const isExist = await userCollection.findOne(query);
      if (isExist) {
        return res.send(isExist);
      }
      const result = await userCollection.insertOne({
        ...user,
        role:'customer',
        timestamp: Date.now(),
      });
      res.send(result);
    });
    app.get('/users/role/:email',verifyToken, async (req, res)=>{
      const email = req.params.email
      const result = await userCollection.findOne({email})
      res.send({role:result?.role})
    })













    // plants
    app.get('/plants', async(req, res)=>{
      const result = await plantsCollection.find().toArray()
      res.send(result)
    })
    //kono seller nije kon kon plant er post korse ta find kore nitase Manage Inventory te nitase. file name MyInventory.jsx
    app.get('/plants/:email',verifyToken,VerifySeller, async (req, res)=>{
      const email = req.params.email
      const result = await plantsCollection.find({'seller.email':email}).toArray()
      res.send(result)
    })
    app.get('/plants/:id', async(req, res)=>{
      const id = req.params.id
      const query = {_id: new ObjectId(id)}
      const result = await plantsCollection.findOne(query)
      res.send(result)
    })
    app.post('/plants',verifyToken,VerifySeller, async(req, res)=>{
      const plant = req.body
      const result = await plantsCollection.insertOne(plant)
      res.send(result)
    })

    app.patch('/plants/quantity/:id', verifyToken, async(req, res)=>{
      const id =req.params.id
      const {quantityToUpdate, status} = req.body
      const filter = {_id: new ObjectId(id)}
      let updatedDocs={
        $inc:{
          quantity: -quantityToUpdate
        }
      }
      if(status === 'in'){
        updatedDocs={
          $inc:{
            quantity: quantityToUpdate
          }
        }
      }
      const result = await plantsCollection.updateOne(filter, updatedDocs)
      res.send(result)
    })

    app.delete('/plants/:id', verifyToken,VerifySeller, async(req, res)=>{
      const id = req.params.id
      const query = {_id: new ObjectId(id)}
      const result = await plantsCollection.deleteOne(query)
      res.send(result)
    })







    //orders
    app.post('/orders',verifyToken, async(req, res)=>{
      const order = req.body
      const result = await ordersCollection.insertOne(order)
      res.send(result)
    })
    app.get('/orders/:email',verifyToken, async(req, res)=>{
      const email = req.params.email
      const query = {'customerEmail':email}
      const result = await ordersCollection.find(query).toArray()
      res.send(result)
    })
    app.delete('/orders/:id',verifyToken, async(req, res)=>{
      const id = req.params.id
      const query = {_id: new ObjectId(id)}
      const order = await ordersCollection.findOne(query)
      if(order.status === 'Delivered'){
        return res.status(409).send("product already delivered")
      }
      const result = await ordersCollection.deleteOne(query)
      res.send(result)
    })




    

    // Generate jwt token
    app.post("/jwt", async (req, res) => {
      const email = req.body;
      const token = jwt.sign(email, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "365d",
      });
      res
        .cookie("token", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        })
        .send({ success: true });
    });
    // Logout
    app.get("/logout", async (req, res) => {
      try {
        res
          .clearCookie("token", {
            maxAge: 0,
            secure: process.env.NODE_ENV === "production",
            sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
          })
          .send({ success: true });
      } catch (err) {
        res.status(500).send(err);
      }
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello from plantNet Server..");
});

app.listen(port, () => {
  console.log(`plantNet is running on port ${port}`);
});
