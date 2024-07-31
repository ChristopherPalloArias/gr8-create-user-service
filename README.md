# Create User Service

This is the microservice for creating User in the +Kotas App.

## Group Members

- Christopher Pallo
- Brayan Dávila

## Table of Contents

1. [Microservice Description](#microservice-description)
2. [Installation](#installation)
   - [Requirements](#requirements)
   - [Clone the Repository](#clone-the-repository)
   - [Install Dependencies](#install-dependencies)
   - [Start the Server](#start-the-server)
   - [Evidence](#evidence)
3. [Usage](#usage)
   - [Verify Server Functionality](#verify-server-functionality)


## Microservice Description

The `create-user-service` microservice is responsible for managing the list of users in the +kotas App. Allows you to list products using an HTTP GET request to the corresponding route.

## Installation

### Requirements

- Node.js
- npm (Node Package Manager)

### Clone the Repository

```sh
https://github.com/ChristopherPalloArias/gr8-create-user-service.git
cd create-user-service
```

### Install Dependencies
```sh
npm install
```

### Starting the Server
Before starting the application you must change the database credentials in the index.js file if you want to use the application locally and independently, this is because initially the application is configured to be used in conjunction with the rest of Microservices.
Repository: [https://github.com/ChristopherPalloArias/kotas-frontend](https://github.com/ChristopherPalloArias/kotas-frontend.git)

### Evidence
![image](https://github.com/user-attachments/assets/101e1ffb-0ac1-48a9-a7f7-2b26e5d69e29)

## Usage
### Verify Server Functionality

Method: POST  
URL: `[http://localhost:8082/](http://gr8-load-balancer-users-1719093065.us-east-2.elb.amazonaws.com:8082/)`  
Description: This route displays a message to verify that the server is running.
![image](https://github.com/user-attachments/assets/3a84cd5e-c52d-427d-ae21-33da994268df)
