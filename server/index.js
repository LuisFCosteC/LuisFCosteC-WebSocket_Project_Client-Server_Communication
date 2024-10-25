// Importamos los módulos necesarios para el servidor
import express from 'express'  // Framework para crear un servidor HTTP
import logger from 'morgan'  // Middleware para registrar las solicitudes HTTP
import dotenv from 'dotenv'  // Cargar variables de entorno desde un archivo .env
import { createClient } from '@libsql/client';  // Crear cliente para interactuar con la base de datos
import { Server } from "socket.io";  // Módulo para configurar y gestionar WebSockets
import { createServer } from "node:http";  // Módulo nativo para crear un servidor HTTP
import { exec } from 'child_process'; // Módulo para ejecutar comandos del sistema operativo desde el servidor, como obtener la IP y MAC
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
        mac TEXT, -- Columna que almacena la mac
        gateway TEXT, -- Columna que almacena el gateway
        operatingSystem TEXT, -- Columna que almacena el operatingSystem
        browser  TEXT -- Columna que almacena el browser
    )
`)

// Función para obtener la dirección MAC del cliente o del servidor según la IP proporcionada
const getMacAddress = (ipv4) => {
    // Retorna una nueva promesa que resolverá con la dirección MAC o rechazará si hay un error
    return new Promise((resolve, reject) => {
        // Verificamos si la IP corresponde a la del servidor
        if (ipv4 === '192.168.18.185') {
            // Asignamos manualmente la dirección MAC del servidor si la IP coincide
            const macAddress = '80-C5-F2-0B-1A-5D';
            // Mostramos en consola la dirección MAC asociada a la IP del servidor
            console.log(`MAC Address for server IP ${ipv4} = ${macAddress}`);
            // Resolvemos la promesa con la dirección MAC del servidor
            resolve(macAddress);
            // Finalizamos la ejecución de la función, sin ejecutar el resto del código
            return;
        }
        
        // Ejecutamos el comando 'arp -a' para obtener la dirección MAC de la IP proporcionada
        exec(`arp -a ${ipv4}`, (error, stdout, stderr) => {
            // Si ocurre un error durante la ejecución del comando
            if (error) {
                // Mostramos el mensaje de error en la consola
                console.error(`Error: ${error.message}`);
                // Rechazamos la promesa con el error y terminamos la ejecución
                reject(error);
                return;
            }
            
            // Si hay un mensaje de error en la salida estándar de error
            if (stderr) {
                // Mostramos el mensaje de error en la consola
                console.error(`Stderr: ${stderr}`);
                // Rechazamos la promesa con el mensaje de error y terminamos la ejecución
                reject(stderr);
                return;
            }

            // Utilizamos una expresión regular para buscar el patrón de una dirección MAC en la salida del comando
            const match = stdout.match(/([0-9a-f]{2}[:-]){5}([0-9a-f]{2})/i);
            // Si encontramos una coincidencia, guardamos la dirección MAC; si no, asignamos 'MAC Address not found'
            const macAddress = match ? match[0] : 'MAC Address not found';
            // Mostramos en consola la dirección MAC obtenida para la IP proporcionada
            console.log(`MAC Address para la IP -> ${ipv4} = ${macAddress}`);
            // Resolvemos la promesa con la dirección MAC obtenida
            resolve(macAddress);
        });
    });
};

// Función que obtiene la puerta de enlace (gateway) a partir de una dirección IP IPv4
const getGatewayByIP = (ipv4) => {
    // Devuelve una promesa que se resuelve cuando se encuentra la puerta de enlace
    return new Promise((resolve, reject) => {
        // Define el comando a ejecutar para obtener la configuración de red
        const command = 'ipconfig';

        // Ejecuta el comando ipconfig en el sistema operativo
        exec(command, (error, stdout, stderr) => {
            // Si ocurre un error durante la ejecución del comando
            if (error) {
                console.error(`Error ejecutando el comando: ${error.message}`); // Imprime el mensaje de error en la consola
                reject(error); // Rechaza la promesa con el error
                return; // Termina la función
            }

            // Si hay un error en la salida estándar de error
            if (stderr) {
                console.error(`Stderr: ${stderr}`); // Imprime el error en la consola
                reject(stderr); // Rechaza la promesa con el stderr
                return; // Termina la función
            }

            // Divide la salida del comando en líneas
            const lines = stdout.split('\n'); 
            let foundIPSection = false; // Variable para indicar si se ha encontrado la sección de la IP
            let gateway = 'Gateway not found'; // Valor predeterminado si no se encuentra la puerta de enlace

            // Recorre cada línea en la salida de ipconfig
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim(); // Elimina espacios en blanco al inicio y al final de la línea

                // Comprueba si la línea contiene la dirección IPv4 proporcionada
                if (line.includes(ipv4)) {
                    foundIPSection = true; // Marca que se encontró la sección de la IP
                }

                // Si se encontró la IP, busca la puerta de enlace en las siguientes líneas
                if (foundIPSection && line.toLowerCase().includes('puerta de enlace predeterminada')) {
                    const match = line.match(/:\s*([0-9.]+)/); // Busca la dirección IP de la puerta de enlace usando una expresión regular
                    if (match) {
                        gateway = match[1]; // Extrae la puerta de enlace de la coincidencia
                        break; // Termina el bucle al encontrar la puerta de enlace
                    }
                }
            }

            // Imprime la puerta de enlace encontrada en la consola
            console.log(`Gateway para la IP -> ${ipv4} = ${gateway}`);
            resolve(gateway); // Resuelve la promesa con la puerta de enlace encontrada
        });
    });
};

// Función para obtener el sistema operativo a partir del User-Agent
const getOperatingSystem = (userAgent) => {
    // Comprueba si el User-Agent contiene la palabra 'windows' (sin importar mayúsculas o minúsculas)
    if (/windows/i.test(userAgent)) {
        return "Windows"; // Devuelve "Windows" si se encuentra
    } 
    // Comprueba si el User-Agent contiene la palabra 'android'
    else if (/android/i.test(userAgent)) {
        return "Android"; // Devuelve "Android" si se encuentra
    } 
    // Comprueba si el User-Agent contiene 'iphone', 'ipad' o 'ipod'
    else if (/iphone|ipad|ipod/i.test(userAgent)) {
        return "iOS"; // Devuelve "iOS" si se encuentra
    } 
    // Comprueba si el User-Agent contiene 'mac os'
    else if (/mac os/i.test(userAgent)) {
        return "macOS"; // Devuelve "macOS" si se encuentra
    } 
    // Comprueba si el User-Agent contiene la palabra 'linux'
    else if (/linux/i.test(userAgent)) {
        return "Linux"; // Devuelve "Linux" si se encuentra
    }
    // Si no se encuentra ninguno de los sistemas operativos anteriores
    return "Desconocido"; // Devuelve "Desconocido" como valor predeterminado
};

// Función para detectar el navegador a partir del User-Agent
const getBrowser = (userAgent) => {
    // Comprueba si el User-Agent contiene 'chrome', 'chromium' o 'crios' (sin importar mayúsculas o minúsculas)
    // Asegura que no sea Edge, ya que este navegador también contiene 'chrome' en su User-Agent
    if (/chrome|chromium|crios/i.test(userAgent) && !/edg/i.test(userAgent)) {
        return "Chrome"; // Devuelve "Chrome" si se encuentra
    } 
    // Comprueba si el User-Agent contiene 'firefox' o 'fxios'
    else if (/firefox|fxios/i.test(userAgent)) {
        return "Firefox"; // Devuelve "Firefox" si se encuentra
    } 
    // Comprueba si el User-Agent contiene 'safari' y asegura que no sea Chrome, Chromium o CriOS
    else if (/safari/i.test(userAgent) && !/chrome|chromium|crios/i.test(userAgent)) {
        return "Safari"; // Devuelve "Safari" si se encuentra
    } 
    // Comprueba si el User-Agent contiene 'edg' (para Edge)
    else if (/edg/i.test(userAgent)) {
        return "Edge"; // Devuelve "Edge" si se encuentra
    } 
    // Comprueba si el User-Agent contiene 'opera' o 'opr'
    else if (/opera|opr/i.test(userAgent)) {
        return "Opera"; // Devuelve "Opera" si se encuentra
    } 
    // Comprueba si el User-Agent contiene 'msie' o 'trident' (para Internet Explorer)
    else if (/msie|trident/i.test(userAgent)) {
        return "Internet Explorer"; // Devuelve "Internet Explorer" si se encuentra
    }
    // Si no se encuentra ninguno de los navegadores anteriores
    return "Desconocido"; // Devuelve "Desconocido" como valor predeterminado
};


//-----------------------------------------------------------------------------------------------------------------------------------------
//-----------------------------------------------------------------------------------------------------------------------------------------
//-----------------------------------------------------------------------------------------------------------------------------------------

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

    // Aquí llamamos a getGatewayByIP
    const gateway = await getGatewayByIP(ipv4);

    /// Obtener el User-Agent del cliente
    const userAgent = socket.handshake.headers['user-agent'] || '';
    
    // Identificar el sistema operativo
    const operatingSystem = getOperatingSystem(userAgent);

    console.log("Sistema operativo:", operatingSystem);

    // Identificar el navegador
    const browser = getBrowser(userAgent);
    
    console.log("Navegador:", browser);

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
        console.log({ username, msg, ipv4, mac, gateway, operatingSystem, browser })

        // Intentamos insertar el mensaje en la base de datos
        try {
            result = await db.execute({
                // Consulta SQL para insertar el contenido del mensaje, el usuario en la tabla 'messages' y la ip
                sql: `INSERT INTO messages (content, user, ip, mac, gateway, operatingSystem, browser) 
                VALUES (:msg, :username, :ipv4, :mac, :gateway, :operatingSystem, :browser)`,
                // Pasamos los argumentos necesarios para la consulta
                args: { msg, username, ipv4, mac, gateway, operatingSystem, browser }
            })
        } catch (e) {
            // En caso de error, lo mostramos en la consola y terminamos la ejecución
            console.error(e)
            return
        }
        // Emitimos el mensaje de chat a todos los clientes conectados, incluyendo el ID del mensaje insertado
        io.emit('chat message', msg, result.lastInsertRowid.toString(), username, ipv4, mac, gateway, operatingSystem, browser)
    })

    // Si el socket no está recuperado (el usuario es nuevo o no ha reconectado), recuperamos los mensajes anteriores
    if (!socket.recovered) {
        // Intentamos obtener los mensajes de la base de datos que tengan un ID mayor que el último conocido por el cliente
        try {
            const results = await db.execute({
                // Consulta SQL para obtener mensajes
                sql: 'SELECT id, content, user, ip, mac, gateway, operatingSystem, browser FROM messages WHERE id > ?',
                // Parámetro: el último ID conocido por el cliente (serverOffset)
                args: [socket.handshake.auth.serverOffset ?? 0]
            })

        // Enviamos cada mensaje recuperado al cliente que se acaba de conectar
        results.rows.forEach(row => {
            // Emitimos un evento 'chat message' al cliente con el contenido, ID y usuario del mensaje
            socket.emit('chat message', row.content, row.id.toString(), row.user, row.ip, row.mac, row.gateway, row.operatingSystem, row.browser)
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
