# KTX Backend Project

## Overview
This project is a backend application for managing a student dormitory (KTX) system. It provides functionalities for user authentication, student management, room management, contract handling, and payment processing.

## Technologies Used
- Node.js
- Express.js
- MSSQL
- Bcrypt.js
- JSON Web Tokens (JWT)

## Project Structure
```
ktx-backend
├── config
│   └── database.js          # Database connection configuration
├── middleware
│   ├── auth.js              # Authentication and authorization middleware
│   └── errorHandler.js      # Centralized error handling middleware
├── repositories
│   ├── authRepository.js     # Authentication-related database operations
│   ├── studentRepository.js  # Student data management
│   ├── roomRepository.js     # Room management operations
│   ├── contractRepository.js  # Contract-related database operations
│   └── paymentRepository.js   # Payment transaction management
├── routes
│   ├── authRoutes.js        # Authentication routes
│   ├── studentRoutes.js     # Student-related routes
│   ├── roomRoutes.js        # Room management routes
│   ├── contractRoutes.js     # Contract management routes
│   └── paymentRoutes.js      # Payment operations routes
├── services
│   ├── authService.js       # Business logic for authentication
│   ├── studentService.js     # Business logic for student management
│   ├── roomService.js        # Business logic for room management
│   ├── contractService.js     # Business logic for contract handling
│   └── paymentService.js      # Business logic for payment management
├── tests
│   └── auth.test.js         # Unit tests for authentication functionality
├── .env.example              # Example environment variables
├── package.json             # npm configuration file
├── server.js                # Entry point of the application
└── README.md                # Project documentation
```

## Setup Instructions
1. Clone the repository:
   ```
   git clone <repository-url>
   cd ktx-backend
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Create a `.env` file based on the `.env.example` file and fill in the required environment variables:
   ```
   DB_SERVER=<your_db_server>
   DB_PORT=<your_db_port>
   DB_NAME=<your_db_name>
   DB_USER=<your_db_user>
   DB_PASSWORD=<your_db_password>
   JWT_SECRET=<your_jwt_secret>
   PORT=<your_port>
   ```

4. Start the server:
   ```
   npm start
   ```

## Usage
- The API provides endpoints for user authentication, student management, room management, contract handling, and payment processing.
- Refer to the individual route files for specific endpoint details and usage.

## Contributing
Contributions are welcome! Please open an issue or submit a pull request for any enhancements or bug fixes.

## License
This project is licensed under the MIT License.