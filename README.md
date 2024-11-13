# Semantic Search with Neo4j and Google Vertex AI

A semantic search engine built with Neo4j and Google Cloud Vertex AI that enables intelligent searching of executive profiles. The system uses vector embeddings generated from executive biographies (using Google's `textembedding-gecko@003` model) stored in a Neo4j graph database.

## Setup

1. Clone the repository
```bash
git clone <repository-url>
cd neo4j-vertex-semantic-search
```

2. Install dependencies
```bash
npm install
```

3. Configure environment variables
Create a `.env` file in the root directory:
```bash
NEO4J_URI="neo4j+s://xxxxx.databases.neo4j.io"
NEO4J_USER="neo4j"
NEO4J_PASSWORD="your-password"
GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account.json"
PROJECT_ID="your-google-project-id"
```

4. Load sample data
```bash
npm run load-data
```

### Technical Implementation

1. Core Components

   - `vertex-ai-client.js` - Handles Vertex AI embedding generation
   - `executive-bio-vectorizer.js` - Manages bio vectorization and index creation
   - `query-client.js` - Handles semantic search queries

2. Project Dependencies

   ```json
   {
     "dependencies": {
       "@google-cloud/aiplatform": "^3.31.0",
       "axios": "^1.7.7",
       "google-auth-library": "^9.14.2",
       "neo4j-driver": "^5.26.0",
       "dotenv": "^16.4.5"
     }
   }
   ```