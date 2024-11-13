require('dotenv').config();

const neo4j = require("neo4j-driver");
const { GoogleAuth } = require("google-auth-library");

/**
 * Configuration object for the application
 * @type {Object}
 */
const config = {
  neo4j: {
    uri: process.env.NEO4J_URI,
    user: process.env.NEO4J_USER,
    password: process.env.NEO4J_PASSWORD
  },
  google: {
    projectId: process.env.GOOGLE_PROJECT_ID,
    location: process.env.GOOGLE_LOCATION || 'us-central1',
    model: process.env.VERTEX_MODEL || 'textembedding-gecko@003'
  },
  batch: {
    size: parseInt(process.env.BATCH_SIZE) || 5,
    vectorDimensions: parseInt(process.env.VECTOR_DIMENSIONS) || 768,
    similarityFunction: process.env.SIMILARITY_FUNCTION || "cosine",
    indexName: process.env.INDEX_NAME || "bio_text_embeddings",
    indexWaitTimeout: parseInt(process.env.INDEX_WAIT_TIMEOUT) || 300
  }
};

// Initialize Neo4j driver
const driver = neo4j.driver(
  config.neo4j.uri,
  neo4j.auth.basic(config.neo4j.user, config.neo4j.password)
);

// Initialize Google Auth
const auth = new GoogleAuth({
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  scopes: ["https://www.googleapis.com/auth/cloud-platform"],
});

/**
 * Get Google Cloud access token
 * @returns {Promise<string>} Access token
 */
async function getAccessToken() {
  try {
    const client = await auth.getClient();
    const token = await client.getAccessToken();
    return token.token;
  } catch (error) {
    console.error("Authentication failed:", error.message);
    throw new Error("Failed to obtain access token");
  }
}

/**
 * Generate embeddings for executive bios
 * @param {neo4j.Session} session - Neo4j session
 * @param {string} accessToken - Google Cloud access token
 * @returns {Promise<number>} Number of processed records
 */
async function generateEmbeddings(session, accessToken) {
  try {
    const result = await session.run(
      `
      MATCH (n:Executive) WHERE size(n.bio) <> 0
      WITH collect(n) AS nodes, toInteger($batchSize) AS batchSize
      CALL {
        WITH nodes
        CALL genai.vector.encodeBatch([node IN nodes | node.bio], 'VertexAI', {
          model: $model,
          token: $accessToken,
          region: $location,
          projectId: $projectId,
          taskType: "CLUSTERING"
        }) YIELD index, vector
        CALL db.create.setNodeVectorProperty(nodes[index], 'textEmbedding', vector)
        RETURN count(*) AS count
      } IN TRANSACTIONS OF toInteger($batchSize) ROWS
      RETURN sum(count) AS totalCount
      `,
      {
        accessToken,
        projectId: config.google.projectId,
        location: config.google.location,
        model: config.google.model,
        batchSize: config.batch.size
      }
    );

    const totalCount = result.records[0].get("totalCount");
    console.log(`Successfully processed ${totalCount} records`);
    return totalCount;
  } catch (error) {
    console.error("Embedding generation failed:", error.message);
    throw new Error("Failed to generate embeddings");
  }
}

/**
 * Create vector index in Neo4j
 * @param {neo4j.Session} session - Neo4j session
 */
async function createVectorIndex(session) {
  try {
    await session.executeWrite((tx) =>
      tx.run(
        `
        CREATE VECTOR INDEX ${config.batch.indexName} IF NOT EXISTS
        FOR (n:Executive)
        ON (n.textEmbedding)
        OPTIONS {
          indexConfig: {
            \`vector.dimensions\`: $dimensions,
            \`vector.similarity_function\`: $similarity
          }
        }
        `,
        {
          dimensions: config.batch.vectorDimensions,
          similarity: config.batch.similarityFunction
        }
      )
    );

    await session.executeRead((tx) =>
      tx.run(`CALL db.awaitIndex($indexName, $timeout)`, {
        indexName: config.batch.indexName,
        timeout: config.batch.indexWaitTimeout,
      })
    );
    
    console.log("Vector index created and ready");
  } catch (error) {
    console.error("Index creation failed:", error.message);
    throw new Error("Failed to create vector index");
  }
}

/**
 * Main process function
 */
async function processBatchEmbeddings() {
  const session = driver.session();
  try {
    const accessToken = await getAccessToken();
    await generateEmbeddings(session, accessToken);
    await createVectorIndex(session);
    console.log("Processing completed successfully");
  } catch (error) {
    console.error("Process failed:", error.message);
    throw error;
  } finally {
    await session.close();
  }
}

// Execute the process
processBatchEmbeddings()
  .then(() => {
    console.log("Application completed successfully");
    driver.close();
  })
  .catch((error) => {
    console.error("Application failed:", error.message);
    driver.close();
    process.exit(1);
  });
