// Importamos los módulos necesarios para el servidor
import express from 'express'  // Framework para crear un servidor HTTP
import logger from 'morgan'  // Middleware para registrar las solicitudes HTTP
import dotenv from 'dotenv'  // Cargar variables de entorno desde un archivo .env
import { createClient } from '@libsql/client';  // Crear cliente para interactuar con la base de datos
import { Server } from "socket.io";  // Módulo para configurar y gestionar WebSockets
import { createServer } from "node:http";  // Módulo nativo para crear un servidor HTTP

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
        user TEXT  -- Columna que almacena el nombre de usuario que envió el mensaje
    )
`)

// Configuramos el evento 'connection' para manejar cuando un cliente se conecta al servidor WebSocket
io.on('connection', async (socket) => {
    // Mostramos un mensaje en la consola cuando un usuario se conecta
    console.log('');
    console.log('A user has connected!')

    // Configuramos el evento 'disconnect' para manejar cuando un cliente se desconecta
    socket.on('disconnect', () => {
        // Mostramos un mensaje en la consola cuando un usuario se desconecta
        console.log('');
        console.log('An user has disconnected')
        console.log('');
    })

    // Escuchamos el evento 'chat message' que recibe un mensaje desde el cliente
    socket.on('chat message', async (msg) => {
        let result  // Variable para almacenar el resultado de la consulta SQL
        // Obtenemos el nombre de usuario desde el socket o usamos 'anonymous' si no está definido
        const username = socket.handshake.auth.username ?? 'anonymous'
        // Mostramos el mensaje y el usuario en la consola
        console.log({ username, msg })

        // Intentamos insertar el mensaje en la base de datos
        try {
            result = await db.execute({
                // Consulta SQL para insertar el contenido del mensaje y el usuario en la tabla 'messages'
                sql: `INSERT INTO messages (content, user) VALUES (:msg, :username)`,
                // Pasamos los argumentos necesarios para la consulta
                args: { msg, username }
            })
        } catch (e) {
            // En caso de error, lo mostramos en la consola y terminamos la ejecución
            console.error(e)
            return
        }
        // Emitimos el mensaje de chat a todos los clientes conectados, incluyendo el ID del mensaje insertado
        io.emit('chat message', msg, result.lastInsertRowid.toString(), username)
    })

    // Si el socket no está recuperado (el usuario es nuevo o no ha reconectado), recuperamos los mensajes anteriores
    if (!socket.recovered) {
        // Intentamos obtener los mensajes de la base de datos que tengan un ID mayor que el último conocido por el cliente
        try {
            const results = await db.execute({
                // Consulta SQL para obtener mensajes
                sql: 'SELECT id, content, user FROM messages WHERE id > ?',
                // Parámetro: el último ID conocido por el cliente (serverOffset)
                args: [socket.handshake.auth.serverOffset ?? 0]
            })

        // Enviamos cada mensaje recuperado al cliente que se acaba de conectar
        results.rows.forEach(row => {
            // Emitimos un evento 'chat message' al cliente con el contenido, ID y usuario del mensaje
            socket.emit('chat message', row.content, row.id.toString(), row.user)
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
