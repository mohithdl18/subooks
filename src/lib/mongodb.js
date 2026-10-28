
import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || "suvilla_bookings";

if (!uri) {
  throw new Error("Please add MONGODB_URI to your .env.local file");
}

const options = {};

let client;
let clientPromise;

if (process.env.NODE_ENV === "development") {
  if (!global._mongoClientPromise) {
    client = new MongoClient(uri, options);
    global._mongoClientPromise = client.connect();
  }

  clientPromise = global._mongoClientPromise;
} else {
  client = new MongoClient(uri, options);
  clientPromise = client.connect();
}

// Collection definitions
const collectionDefinitions = [
  {
    name: "room_availabilty",
    validator: {
      $jsonSchema: {
        bsonType: "object",
        required: ["date", "booked_rooms"],
        properties: {
          date: {
            bsonType: "string",
            description: "Date in YYYY-MM-DD format",
          },
          booked_rooms: {
            bsonType: "array",
            items: {
              bsonType: "string",
            },
          },
        },
      },
    },
  },
  {
    name: "bookings_data",
    validator: {
      $jsonSchema: {
        bsonType: "object",
        required: [
          "booking_id",
          "personal_info",
          "dinner",
          "driver",
          "terms_conditions",
          "paid_amount",
          "status",
        ],
        properties: {
          booking_id: {
            bsonType: "string",
          },
          personal_info: {
            bsonType: "object",
            required: [
              "name",
              "email",
              "phone_number",
              "aadhar_number",
              "address",
              "pin_code",
              "city",
              "special_request",
            ],
            properties: {
              name: { bsonType: "string" },
              email: { bsonType: "string" },
              phone_number: { bsonType: "string" },
              aadhar_number: { bsonType: "string" },
              address: { bsonType: "string" },
              pin_code: { bsonType: "string" },
              city: { bsonType: "string" },
              special_request: { bsonType: "string" },
            },
          },
          dinner: {
            bsonType: ["int", "long", "double"],
            minimum: 0,
          },
          driver: {
            bsonType: "object",
            required: ["accommodation", "dinner"],
            properties: {
              accommodation: {
                enum: ["yes", "no"],
              },
              dinner: {
                enum: ["yes", "no"],
              },
            },
          },
          terms_conditions: {
            enum: ["yes", "no"],
          },
          paid_amount: {
            bsonType: ["int", "long", "double", "decimal"],
            minimum: 0,
          },
          status: {
            bsonType: "string",
          },
        },
      },
    },
  },
  {
    name: "temp_books",
  },
];

// Create missing collections only.
async function ensureCollections(db) {
  const existingCollections = await db
    .listCollections({}, { nameOnly: true })
    .toArray();

  const existingNames = new Set(
    existingCollections.map((collection) => collection.name)
  );

  for (const definition of collectionDefinitions) {
    if (existingNames.has(definition.name)) {
      continue;
    }

    const options = definition.validator
      ? { validator: definition.validator }
      : {};

    try {
      await db.createCollection(definition.name, options);
    } catch (error) {
      // Ignore namespace-exists errors from concurrent initialization.
      if (error.code !== 48) {
        throw error;
      }
    }
  }
}

// Get the database and ensure all three collections exist.
export async function getDb() {
  const client = await clientPromise;
  const db = client.db(dbName);

  await ensureCollections(db);

  return db;
}

// Reusable MongoDB client connection.
export { clientPromise };
