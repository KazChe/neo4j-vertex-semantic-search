require('dotenv').config();
const neo4j = require('neo4j-driver');

// JSON data
const data = {
  executives: [
    {
      name: "Alice Johnson",
      title: "Chief Marketing Officer",
      bio: "Alice Johnson is a seasoned marketing executive with over 15 years of experience in digital transformation and brand development. She has led successful marketing campaigns for Fortune 500 companies and pioneered several innovative digital marketing strategies."
    },
    {
      name: "John Doe",
      title: "Chief Financial Officer",
      bio: "John Doe brings 20 years of financial expertise in technology and manufacturing sectors. He has overseen multiple successful mergers and acquisitions, and specializes in strategic financial planning and risk management."
    }
  ]
};

// Initialize Neo4j driver
const driver = neo4j.driver(
  process.env.NEO4J_URI,
  neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD)
);

// Define the Cypher query
const cypherQuery = `
// Create constraints for uniqueness
CREATE CONSTRAINT executive_name IF NOT EXISTS
FOR (e:Executive) REQUIRE e.full_name IS UNIQUE;

// Load executives with their bios
UNWIND $executives AS exec
MERGE (e:Executive {full_name: exec.name})
SET 
    e.title = exec.title,
    e.bio = exec.bio;
`;

// Run the query
async function loadExecutives() {
  const session = driver.session();
  try {
    await session.run(cypherQuery, { executives: data.executives });
    console.log("Executives loaded successfully.");
  } catch (error) {
    console.error("Error loading executives:", error);
  } finally {
    await session.close();
  }
}

loadExecutives()
  .then(() => driver.close())
  .catch((error) => {
    console.error("Unexpected error:", error);
    process.exit(1);
  });
