// Importamos los módulos necesarios para el servidor
import express from 'express'  // Framework para crear un servidor HTTP
import logger from 'morgan'  // Middleware para registrar las solicitudes HTTP
import dotenv from 'dotenv'  // Cargar variables de entorno desde un archivo .env
import { createClient } from '@libsql/client';  // Crear cliente para interactuar con la base de datos
import { Server } from "socket.io";  // Módulo para configurar y gestionar WebSockets
import { createServer } from "node:http";  // Módulo nativo para crear un servidor HTTP
import { exec } from 'child_process';
import os from 'os'; // Importar el módulo 'os'

// Cargamos las variables de entorno definidas en el archivo .env
dotenv.config()

// Definimos el puerto donde se ejecutará el servidor, tomando de .env o por defecto el 3000
const port = process.env.PORT ?? 3000

// Inicializamos la aplicación Express
const app = express()

// Se crea el servidor HTTP basado en Express
const server = createServer(app)

// Configuramos el servidor de WebSockets, permitiendo la recuperación del estado de la conexión
const io = new Server(server, {
    connectionStateRecovery: {}  // Habilita la recuperación de estado de conexión para los usuarios que se reconectan
})

// Creamos la conexión a la base de datos utilizando las credenciales obtenidas de las variables de entorno
const db = createClient({
    url: process.env.DB_URL,  // URL de la base de datos desde el archivo .env
    authToken: process.env.DB_TOKEN  // Token de autenticación para la base de datos
})

// Ejecutamos una consulta SQL para crear la tabla 'messages' si aún no existe
await db.execute(`
    CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,  -- ID autoincremental como clave primaria
        content TEXT,  -- Columna que almacena el contenido del mensaje
        user TEXT,  -- Columna que almacena el nombre de usuario que envió el mensaje
        ip INTEGER, -- Columna que almacena la ip del usuario
        mac TEXT -- Columna que almacena la mac
    )
`)

// Función para obtener la dirección MAC del cliente
const getMacAddress = (ipv4) => {
    return new Promise((resolve, reject) => {
        // Si la IP corresponde a la del servidor, devolvemos la MAC asignada
        if (ipv4 === '192.168.18.185') {
            const macAddress = '80-C5-F2-0B-1A-5D';
            console.log(`MAC Address for server IP ${ipv4} = ${macAddress}`);
            resolve(macAddress);
            return;
        }
        exec(`arp -a ${ipv4}`, (error, stdout, stderr) => {
            if (error) {
                console.error(`Error: ${error.message}`);
                reject(error);
                return;
            }
            if (stderr) {
                console.error(`Stderr: ${stderr}`);
                reject(stderr);
                return;
            }

            const match = stdout.match(/([0-9a-f]{2}[:-]){5}([0-9a-f]{2})/i);
            const macAddress = match ? match[0] : 'MAC Address not found';
            console.log(`MAC Address for -> ${ipv4} = ${macAddress}`);
            resolve(macAddress);
        });
    });
};


// Configuramos el evento 'connection' para manejar cuando un cliente se conecta al servidor WebSocket
io.on('connection', async (socket) => {
    // Mostramos un mensaje en la consola cuando un usuario se conecta
    console.log('');
    console.log('A user has connected!')

    // Obtener la dirección IP local del cliente
    const clientIp = socket.handshake.address;

    // Extrae la ip de IPv6 a IPv4
    const ipv4 = clientIp.startsWith('::ffff:') ? clientIp.substring(7) : clientIp;

    // Mostramos un mensaje en la consola con la ip del usuario
    console.log('IP: ', ipv4)

    // Obtener MAC
    const mac = await getMacAddress(ipv4);

    // Configuramos el evento 'disconnect' para manejar cuando un cliente se desconecta
    socket.on('disconnect', () => {
        // Mostramos un mensaje en la consola cuando un usuario se desconecta
        console.log('');
        console.log('An user has disconnected', 'IP: ', ipv4)
        console.log('');
    })

    // Escuchamos el evento 'chat message' que recibe un mensaje desde el cliente
    socket.on('chat message', async (msg) => {
        let result  // Variable para almacenar el resultado de la consulta SQL
        // Obtenemos el nombre de usuario desde el socket o usamos 'anonymous' si no está definido
        const username = socket.handshake.auth.username ?? 'anonymous'
        // Mostramos el mensaje y el usuario en la consola
        console.log({ username, msg, ipv4, mac })

        // Intentamos insertar el mensaje en la base de datos
        try {
            result = await db.execute({
                // Consulta SQL para insertar el contenido del mensaje, el usuario en la tabla 'messages' y la ip
                sql: `INSERT INTO messages (content, user, ip, mac) VALUES (:msg, :username, :ipv4, :mac)`,
                // Pasamos los argumentos necesarios para la consulta
                args: { msg, username, ipv4, mac }
            })
        } catch (e) {
            // En caso de error, lo mostramos en la consola y terminamos la ejecución
            console.error(e)
            return
        }
        // Emitimos el mensaje de chat a todos los clientes conectados, incluyendo el ID del mensaje insertado
        io.emit('chat message', msg, result.lastInsertRowid.toString(), username, ipv4, mac)
    })

    // Si el socket no está recuperado (el usuario es nuevo o no ha reconectado), recuperamos los mensajes anteriores
    if (!socket.recovered) {
        // Intentamos obtener los mensajes de la base de datos que tengan un ID mayor que el último conocido por el cliente
        try {
            const results = await db.execute({
                // Consulta SQL para obtener mensajes
                sql: 'SELECT id, content, user, ip, mac FROM messages WHERE id > ?',
                // Parámetro: el último ID conocido por el cliente (serverOffset)
                args: [socket.handshake.auth.serverOffset ?? 0]
            })

        // Enviamos cada mensaje recuperado al cliente que se acaba de conectar
        results.rows.forEach(row => {
            // Emitimos un evento 'chat message' al cliente con el contenido, ID y usuario del mensaje
            socket.emit('chat message', row.content, row.id.toString(), row.user, row.ip, row.mac)
        })

        } catch (e) {
            // Si ocurre un error durante la consulta, lo mostramos en la consola
            console.error(e)
        }
    }
})

// Usamos 'morgan' para registrar todas las solicitudes HTTP realizadas al servidor
app.use(logger('dev'))

// Definimos una ruta GET para la página principal del chat
app.get('/', (req, res) => {
    // Enviamos el archivo HTML al cliente para servir la interfaz del chat
    res.sendFile(process.cwd() + '/client/index.html')
})

// Ponemos el servidor HTTP a escuchar en el puerto especificado
server.listen(port, () => {
    // Mostramos en la consola que el servidor está corriendo en el puerto indicado
    console.log('');
    console.log(`Server running on port ${port}`)
})
