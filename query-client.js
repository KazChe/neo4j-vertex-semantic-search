const neo4j = require("neo4j-driver");
const { GoogleAuth } = require("google-auth-library");
const axios = require("axios");

// Neo4j and Google Cloud setup
const NEO4J_URI = process.env.NEO4J_URI;
const NEO4J_USER = process.env.NEO4J_USER;
const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD;
const PROJECT_ID = process.env.GOOGLE_PROJECT_ID;

// Google Cloud Authentication
const auth = new GoogleAuth({
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  scopes: ["https://www.googleapis.com/auth/cloud-platform"],
});

// Initialize Neo4j driver
const driver = neo4j.driver(
  NEO4J_URI,
  neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD)
);

async function getEmbedding(text) {
  const LOCATION = "us-central1";
  const MODEL = "textembedding-gecko@003";

  const client = await auth.getClient();
  const token = await client.getAccessToken();

  const apiUrl = `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/${LOCATION}/publishers/google/models/${MODEL}:predict`;

  const requestBody = {
    instances: [{ content: text, taskType: "CLUSTERING" }],
    parameters: { dimension: 768 },
  };

  const response = await axios.post(apiUrl, requestBody, {
    headers: {
      Authorization: `Bearer ${token.token}`,
      "Content-Type": "application/json",
    },
  });

  return response.data.predictions[0].embeddings;
}

async function queryNeo4j(query, params = {}) {
  const session = driver.session();
  try {
    const result = await session.run(query, params);
    return result.records;
  } finally {
    await session.close();
  }
}

async function semanticSearch(query, limit = 5) {
  const embeddingResponse = await getEmbedding(query);

  // Ensure we're using the 'values' array from the embedding response
  const embedding = embeddingResponse.values;

  if (!Array.isArray(embedding) || embedding.length !== 768) {
    throw new Error(
      `Invalid embedding: expected array of 768 numbers, got ${embedding}`
    );
  }

  const cypher = `
    CALL db.index.vector.queryNodes($indexName, $k, $embedding)
    YIELD node, score
    RETURN node.full_name AS name, node.bio AS bio, score
    ORDER BY score DESC
  `;

  const params = {
    indexName: "bio_text_embeddings",
    k: limit,
    embedding: embedding,
  };

  const results = await queryNeo4j(cypher, params);
  return results.map((record) => ({
    name: record.get("name"),
    bio: record.get("bio"),
    score: record.get("score"), // Removed toNumber() here
  }));
}

async function main() {
  try {
    const query = "driving cars on the moon";
    console.log("Generating embedding for query...");
    const results = await semanticSearch(query);
    console.log("Search results:");
    results.forEach((result, index) => {
      console.log(`\n${index + 1}. ${result.name} (Score: ${result.score})`);
      console.log(`   ${result.bio ? result.bio : "No bio available"}...`);
    });
  } catch (error) {
    console.error("Error during semantic search:", error);
    if (error.response) {
      console.error("API response error:", error.response.data);
    }
  } finally {
    await driver.close();
  }
}

main();
