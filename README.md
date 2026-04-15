# Food Delivery Platform 🍕

A **Zomato-like food delivery platform** built with Express.js and MySQL. Features three user roles: Customer, Restaurant, and Rider with complete order management workflow.

## 📋 Project Overview

This is a full-stack web application that handles:
- **Customer**: Browse restaurants, place orders, track deliveries
- **Restaurant**: Manage menu, view orders, update order status
- **Rider**: Accept and manage deliveries, update delivery status

## 🛠️ Tech Stack

- **Backend**: Node.js, Express.js
- **Database**: MySQL 2
- **Security**: bcryptjs, express-session
- **Middleware**: CORS
- **Development**: nodemon

## 📁 Project Structure

```
├── database/
│   ├── schema.sql          # Database tables & schema
│   └── setup.js            # Seeder script with demo data
├── server/
│   ├── index.js            # Express server entry point
│   ├── db.js               # Database connection config
│   └── routes/             # API endpoints
│       ├── auth.js         # Login/Signup
│       ├── restaurants.js  # Restaurant operations
│       ├── orders.js       # Order management
│       ├── riders.js       # Rider operations
│       ├── reviews.js      # Customer reviews
│       └── addresses.js    # Address management
├── public/                 # Frontend assets
│   ├── index.html          # Landing page
│   ├── login.html          # Authentication
│   ├── css/style.css       # Styling
│   ├── js/
│   │   ├── api.js          # API client
│   │   └── auth.js         # Auth utilities
│   ├── customer/           # Customer pages
│   ├── restaurant/         # Restaurant pages
│   └── rider/              # Rider pages
└── package.json            # Dependencies & scripts
```

## 🚀 Quick Start

### 1. Prerequisites
- Node.js (v14 or higher)
- MySQL Server running locally
- npm (comes with Node.js)

### 2. Installation

```bash
# Clone the repository
git clone <repository-url>
cd "dbms project"

# Install dependencies
npm install

# Configure database
node database/setup.js
```

### 3. Run the Server

**Development mode** (with auto-reload):
```bash
npm run dev
```

**Production mode**:
```bash
npm start
```

The server will start on `http://localhost:3000`

## 📚 API Endpoints

### Authentication
- `POST /api/auth/signup` — Register new user
- `POST /api/auth/login` — User login
- `POST /api/auth/logout` — User logout

### Restaurants
- `GET /api/restaurants` — List all restaurants
- `GET /api/restaurants/:id` — Get restaurant details
- `POST /api/restaurants` — Create restaurant (admin)

### Orders
- `POST /api/orders` — Create new order
- `GET /api/orders/:id` — Get order details
- `PUT /api/orders/:id` — Update order status

### Riders
- `GET /api/riders/available` — Get available riders
- `POST /api/riders/deliver/:orderId` — Accept delivery

### Reviews
- `POST /api/reviews` — Submit review
- `GET /api/restaurants/:id/reviews` — Get restaurant reviews

## 📖 Database Setup

The `setup.js` script automatically:
- Creates all required tables from `schema.sql`
- Populates demo data for testing:
  - 3 sample restaurants
  - 2 sample customers
  - 2 sample riders
  - Demo orders and reviews

## 🎯 User Workflows

### Customer Flow
1. Sign up / Login
2. Browse restaurants
3. Select restaurant & items
4. Add to cart & checkout
5. Track order in real-time
6. Leave review after delivery

### Restaurant Flow
1. Sign up / Login
2. Manage menu items
3. View incoming orders
4. Update order status
5. View ratings & reviews

### Rider Flow
1. Sign up / Login
2. View available deliveries
3. Accept order
4. Update delivery status
5. Complete delivery

## 🔐 Security Features

- Password hashing with bcryptjs
- Session management with express-session
- CORS enabled for cross-origin requests

## 📝 Environment Configuration

Create a `.env` file in the root directory:

```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=food_delivery
PORT=3000
```

## 🐛 Troubleshooting

### Database Connection Error
- Ensure MySQL is running
- Check database credentials in `server/db.js`
- Run `node database/setup.js` to create tables

### Port Already in Use
- Change `PORT` in `.env` or edit `server/index.js`

### Module Not Found
- Delete `node_modules/` and run `npm install` again

## 📦 Dependencies

See `requirements.txt` for the complete list of Node.js dependencies.

## 👥 Contributors

Project developed as a DBMS course assignment.

## 📜 License

This project is provided as-is for educational purposes.

---

**Need help?** Check the [task.md](task.md) for project completion status.
