require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { graphqlHTTP } = require('express-graphql');
const schema = require('./graphql/schema');
const resolvers = require('./graphql/resolvers');
const questionRoutes = require('./routes/questionRoutes');

const app = express();

app.use(cors());
app.use(express.json());

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB error:', err));

// REST API Routes
app.use('/api', questionRoutes);

// GraphQL Endpoint
app.use('/graphql', graphqlHTTP({
  schema: schema,
  rootValue: resolvers,
  graphiql: true, // Enable GraphiQL interface for testing
  customFormatErrorFn: (error) => ({
    message: error.message,
    locations: error.locations,
    stack: error.stack ? error.stack.split('\n') : [],
    path: error.path
  })
}));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`GraphQL endpoint: http://localhost:${PORT}/graphql`);
});