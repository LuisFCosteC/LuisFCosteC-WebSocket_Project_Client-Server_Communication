# WebSocket Project: Client-Server Communication
This project implements a WebSocket application that enables real-time communication between a client and a server. The architecture is designed to allow both ends to exchange information, including querying request headers and the ability to answer arithmetic questions.

# Project Structure

The project consists of the following main files:

### **1. HTML (`index.html`)**

The HTML file contains the Graphical Interface with which the interaction with the client is made to have a communication with the server. It contains:

- **Script (WebSocket)**
  - The page includes a script in ES6+ to handle WebSocket communication.
  - WebSocket connection: Uses socket.io to establish the connection to a server at the address ```` http://192.168.18.185:3000 ````.
  - Authentication: Uses a username stored in localStorage or generates a random one from an external API.
  - Messaging Events: Listens and emits chat message events and computes results of basic and trigonometric operations.

- Interface Elements (DOM)
  - Chat Form: Chat elements (```` #form ````, ```` #input ````, ```` #messages ````) to send and receive messages. Messages include additional information (IP, MAC, operating system, browser).
  - Basic and Trigonometric Calculator: Sections that allow the user to enter numbers and select operations to send them to the WebSocket server, which calculates and returns the result.

- CSS Styles
  - General Styles: Include a display: grid to center the content, gap for spacing, and general fonts and margins.
  - Light and Dark Mode: The layout adapts the colors according to the preferred color scheme (light or dark) of the system.
  - Calculator and Chat Styles: The chat and calculator elements have rounded edges, specific spacing, and background colors adapted to each mode (light and dark).

- WebSocket Calculator Components
  - The calculator allows the user to send basic arithmetic and trigonometric operations to the server.
  - Results are dynamically displayed in the HTML document (```` #result ```` for basic calculations and ```` #resultTrigonometrica ```` for trigonometric calculations).

> [!NOTE]
> **Link to file:** ```` client/index.html ````

### **2. JS (`index.js`)**

- **Import and Initial Configuration**
  - **Dependencies:**
    - express: HTTP framework to create the server.
    - morgan: To log HTTP requests.
    - dotenv: To load environment variables from an .env file.
    - @libsql/client: Database client.
    - Socket.io: Handles WebSocket connections.
    - child_process, os, and dns: Used to obtain system information, such as IP address, MAC, hostname, operating system, and browser from the client.

  - **Server Configuration:**
      - Port configured from ```` .env ```` or 3000 by default.
      - Express and Socket.io initialization, with ```` connectionStateRecovery ```` for clients to maintain state when reconnecting.

  - **Database:**
      - ```` messages ```` table is created if it does not exist, with columns to store messages and details such as IP, MAC, hostname, operating system and browser.

- **Functions to Obtain Client Information**
  - MAC Address (````getMacAddress````):
    - Uses ````arp -a```` to get the MAC of an IP, with a manual mapping to the server IP.
  - Hostname (````getHostnameByIP````):
    - Uses ````dns.lookupService```` to get the hostname based on the client IP.
  - Operating System and Browser:
    - ````getOperatingSystem```` and ````getBrowser```` parse the ````User-Agent```` to identify the operating system and browser.

- **Calculation Functions**
  - Functions for basic calculations, such as ````potencia```` and ````factorial````, to perform mathematical operations requested by customers.

- **WebSocket Events**
  - Connection:
    - When connecting, the server obtains IP, MAC, hostname, operating system, and browser from the client, and logs these details in the console.
  - Disconnect:
    - On disconnect, the IP of the disconnected client is displayed in the console.
  - Chat Message:
    - In ````chat message````, the message along with the client data (IP, MAC, hostname, operating system, browser) are stored in the database.

> [!NOTE]
> **Link to file:** ```` server/index.js ````

### **3. .env**

- **DB_URL**
  - This URL establishes the connection to the turso database, managed by libsql.

- **DB_TOKEN**
  - This is an authentication token to access the database. It is the authentication that allows authentication to the database without sending credentials such as username and password.

> [!NOTE]
> **Link to file:** ````.env````

# Requirements
> [!IMPORTANT]
> These are the requirements you need to have

### **Server (index.js)**
- Node.js
- Express
- Morgan
- dotenv
- @libsql/client
- Socket.IO
- dns (Node.js native module)
- os (Node.js native module)
- child_process (Node.js native module)
- ````.env```` file

## Installation
1. Create a virtual environment.
   ````bash
   npm init -y
   ````

2. Install the dependencies:
   ````bash
   npm install express morgan dotenv @libsql/client socket.io
   ````

3. Run the server

  - Inside the package.json file that is created when installing the dependencies, we add a script which will allow us to run the server, in our case we have the following script, *run_server* which executes the following command ````node --watch ./server/index.js````
   ````bash
   npm run run_server
   ````

# Presentation of the site
