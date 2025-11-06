const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const WebSocket = require("ws");
const mongoose = require("mongoose");

const uri = "mongodb+srv://ravi:7OWFqQtQpXLzWCE5@cluster0.mkeur.mongodb.net/order_notifications?retryWrites=true&w=majority";

async function connectDB() {
  try {
    await mongoose.connect(uri);
    console.log("✅ MongoDB connected successfully");
  } catch (err) {
    console.error("❌ MongoDB connection error:", err.message);
  }
}

connectDB();

const Notification = mongoose.model(
  "Notification",
  new mongoose.Schema({
    order_id: Number,
    user_name: String,
    total: Number,
    created_at: { type: Date, default: Date.now },
  })
);

const app = express();
app.use(cors());
app.use(bodyParser.json());

const wss = new WebSocket.Server({ port: 6001 });
console.log("✅ WebSocket running on ws://localhost:6001");

function broadcast(data) {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
}

app.post("/send", async (req, res) => {
  const { event, data } = req.body;

  if (event === "order_created") {
    await Notification.create({
      order_id: data.id,
      user_name: data.user,
      total: data.total,
    });
  }

  broadcast({ event, data });
  console.log("📢 Broadcasted:", event, data);

  res.json({ success: true });
});


app.get("/notifications", async (req, res) => {
  try {
    const list = await Notification.find().sort({ created_at: -1 });
    res.json(list);
  } catch (err) {
    console.error("❌ Error fetching notifications:", err);
    res.status(500).json({ error: "Server error" });
  }
});


// 🗑️ Single delete
app.delete("/notifications/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const deleted = await Notification.findByIdAndDelete(id);

    if (!deleted) {
      return res.status(404).json({ success: false, message: "Not found" });
    }

    console.log(`🗑️ Deleted notification ID: ${id}`);
    res.json({ success: true, message: "Notification deleted" });
  } catch (err) {
    console.error("❌ Error deleting:", err);
    res.status(500).json({ error: "Server error" });
  }
});


// 🧹 Multi delete (delete many by IDs)
app.post("/notifications/delete-multiple", async (req, res) => {
  try {
    const { ids } = req.body; // expects array of Mongo _id values

    if (!ids || !Array.isArray(ids)) {
      return res.status(400).json({ success: false, message: "IDs array required" });
    }

    const result = await Notification.deleteMany({ _id: { $in: ids } });
    console.log(`🗑️ Deleted ${result.deletedCount} notifications`);

    res.json({
      success: true,
      deletedCount: result.deletedCount,
      message: "Notifications deleted",
    });
  } catch (err) {
    console.error("❌ Error in bulk delete:", err);
    res.status(500).json({ error: "Server error" });
  }
});



app.listen(6002, () =>
  console.log("🌐 HTTP API listening on http://localhost:6002")
);
