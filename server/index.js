// Importamos los módulos necesarios para el servidor
import express from 'express'  // Framework para crear un servidor HTTP
import logger from 'morgan'  // Middleware para registrar las solicitudes HTTP
import dotenv from 'dotenv'  // Cargar variables de entorno desde un archivo .env
import { createClient } from '@libsql/client';  // Crear cliente para interactuar con la base de datos
import { Server } from "socket.io";  // Módulo para configurar y gestionar WebSockets
import { createServer } from "node:http";  // Módulo nativo para crear un servidor HTTP
import { exec } from 'child_process'; // Módulo para ejecutar comandos del sistema operativo desde el servidor, como obtener la IP y MAC
import os from 'os'; // Importar el módulo 'os'
import dns from 'dns';  // Importar el módulo 'dns'

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
        hostname TEXT, -- Columna que almacena el hostname
        operatingSystem TEXT, -- Columna que almacena el operatingSystem
        browser  TEXT -- Columna que almacena el browser
    )
`)

//-----------------------------------------------------------------------------------------------------------------------------------------
//---------------------------------------- FUNCIONES PARA OBTENER INFORMACION DEL CLIENTE -------------------------------------------------
//-----------------------------------------------------------------------------------------------------------------------------------------
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

// Función para obtener el nombre de host a partir de una dirección IP
const getHostnameByIP = (ipv4) => {
    // Retorna una nueva promesa que resolverá con el nombre de host o rechazará si hay un error
    return new Promise((resolve, reject) => {
        // Usamos el método 'lookupService' del módulo 'dns' para resolver el nombre de host
        dns.lookupService(ipv4, 0, (error, hostname) => {
            if (error) {
                // Si ocurre un error de tipo ENOTFOUND, lo manejamos con un mensaje personalizado
                if (error.code === 'ENOTFOUND') {
                    console.error(`Hostname no encontrado para la IP ${ipv4}`);
                    resolve("Hostname no encontrado");
                } else {
                    // Para otros tipos de errores, imprimimos el mensaje de error y rechazamos la promesa
                    console.error(`Error al resolver el nombre de host: ${error.message}`);
                    reject(error);
                }
                return;
            }
            // Mostramos el nombre de host encontrado en la consola
            console.log(`Nombre de host para la IP ${ipv4} = ${hostname}`);
            // Resolvemos la promesa con el nombre de host
            resolve(hostname);
        });
    });
};

// Función para obtener el sistema operativo a partir del User-Agent
const getOperatingSystem = (userAgent) => {
    if (/windows/i.test(userAgent)) {
        return "Windows";
    } else if (/android/i.test(userAgent)) {
        return "Android";
    } else if (/iphone|ipad|ipod/i.test(userAgent)) {
        return "iOS";
    } else if (/mac os/i.test(userAgent)) {
        return "macOS";
    } else if (/linux/i.test(userAgent)) {
        return "Linux";
    }
    return "Desconocido";
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
//---------------------------------------- FUNCIONES PARA REALIZAR LOS CALCULOS CORRESPONDIENTES ------------------------------------------
//-----------------------------------------------------------------------------------------------------------------------------------------

// Función para calcular la Potenciación
function potencia(base, exponente) {
    return Math.pow(base, exponente); // Calcula base elevado a la potencia del exponente
}


// Función para calcular el factorial
function factorial(n) {
    if (n < 0) return 'Error: No se puede calcular el factorial de un número negativo.'; // Manejo de negativo
    if (n === 0 || n === 1) return 1; // Caso base
    let result = 1; // Inicializamos el resultado
    for (let i = 2; i <= n; i++) { // Iteramos desde 2 hasta n
        result *= i; // Multiplicamos cada número por el resultado acumulado
    }
    return result; // Retornamos el resultado final
}

//-----------------------------------------------------------------------------------------------------------------------------------------
//---------------------------------- EVENTO PARA SABER LA CONEXION Y LOS CALCULOS REQUERIDOS POR EL CLIENTE -------------------------------
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

    // Aquí llamamos a getHostnameByIP 
    const hostname = await getHostnameByIP(ipv4);

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
        console.log({ username, msg, ipv4, mac, hostname, operatingSystem, browser })

        // Intentamos insertar el mensaje en la base de datos
        try {
            result = await db.execute({
                // Consulta SQL para insertar el contenido del mensaje, el usuario en la tabla 'messages' y la ip
                sql: `INSERT INTO messages (content, user, ip, mac, hostname, operatingSystem, browser) 
                VALUES (:msg, :username, :ipv4, :mac, :hostname, :operatingSystem, :browser)`,
                // Pasamos los argumentos necesarios para la consulta
                args: { msg, username, ipv4, mac, hostname, operatingSystem, browser }
            })
        } catch (e) {
            // En caso de error, lo mostramos en la consola y terminamos la ejecución
            console.error(e)
            return
        }
        // Emitimos el mensaje de chat a todos los clientes conectados, incluyendo el ID del mensaje insertado
        io.emit('chat message', msg, result.lastInsertRowid.toString(), username, ipv4, mac, hostname, operatingSystem, browser)
    })

    // Si el socket no está recuperado (el usuario es nuevo o no ha reconectado), recuperamos los mensajes anteriores
    if (!socket.recovered) {
        // Intentamos obtener los mensajes de la base de datos que tengan un ID mayor que el último conocido por el cliente
        try {
            const results = await db.execute({
                // Consulta SQL para obtener mensajes
                sql: 'SELECT id, content, user, ip, mac, hostname, operatingSystem, browser FROM messages WHERE id > ?',
                // Parámetro: el último ID conocido por el cliente (serverOffset)
                args: [socket.handshake.auth.serverOffset ?? 0]
            })

        // Enviamos cada mensaje recuperado al cliente que se acaba de conectar
        results.rows.forEach(row => {
            // Emitimos un evento 'chat message' al cliente con el contenido, ID y usuario del mensaje
            socket.emit('chat message', row.content, row.id.toString(), row.user, row.ip, row.mac, row.hostname, row.operatingSystem, row.browser)
        })

        } catch (e) {
            // Si ocurre un error durante la consulta, lo mostramos en la consola
            console.error(e)
        }
    }

        //-----------------------------------------------------------------------------------------------------------------------------------------
        //----------------------------------------------- EVENTO PARA REALIZAR LOS CALCULOS -------------------------------------------------------
        //-----------------------------------------------------------------------------------------------------------------------------------------
        // Configuramos el evento 'calcular' para manejar las operaciones
        io.on('connection', (socket) => {
            console.log('Un usuario se ha conectado!'); // Notificamos en la consola cuando un usuario se conecta

            // Manejamos el evento de cálculo para operaciones de dos números
            socket.on('calcular', (data) => {
                const { num1, num2, operation } = data; // Desestructuramos el número y la operación
                let resultado; // Variable para almacenar el resultado de la operación

                // Usamos un switch para determinar qué operación realizar según el valor de 'operation'
                switch (operation) {
                    case 'suma':
                        resultado = num1 + num2; // Realizamos la suma
                        break;
                    case 'resta':
                        resultado = num1 - num2; // Realizamos la resta
                        break;
                    case 'multiplicacion':
                        resultado = num1 * num2; // Realizamos la multiplicación
                        break;
                    case 'division':
                        if (num2 === 0) {
                            resultado = 'Error: División por cero no permitida.'; // Manejo de división por cero
                        } else {
                            resultado = num1 / num2; // Realizamos la división
                        }
                        break;
                    case 'logaritmo':
                        if (num1 <= 0) {
                            resultado = 'Error: El logaritmo solo está definido para números positivos.'; // Manejo de logaritmos de números no positivos
                        } else if (num2 === 1) {
                            resultado = 'Error: La base del logaritmo no puede ser 1.'; // Manejo de base 1
                        } else {
                            resultado = Math.log(num1) / Math.log(num2); // Cálculo del logaritmo en base num2
                        }
                        break;
                    case 'potencia':
                        resultado = potencia(num1, num2); // Llamamos a la función de potencia
                        break;
                    default:
                        resultado = 'Operación no válida.'; // Manejo de operaciones no válidas
                }

                // Enviamos el resultado de vuelta al cliente
                socket.emit('resultado', resultado);
            });

            // Manejamos el evento de cálculo para operaciones Trigonometricas
            socket.on('calcularTrigonometrica', (data) => {
                const { numTrigonometrica, operationTrigonometrica } = data; // Desestructuramos el número y la operación
                let resultadoTrigonometrica;

                // Usamos un switch para determinar qué operación realizar según el valor de 'operation'
                switch (operationTrigonometrica) {
                    case 'factorial':
                        resultadoTrigonometrica = factorial(numTrigonometrica); // Realizamos el factorial
                        break;
                    case 'sqrt':
                        if (numTrigonometrica < 0) {
                            resultadoTrigonometrica = 'Error: No se puede calcular la raíz cuadrada de un número negativo.'; // Manejo de raíz cuadrada de un número negativo
                        } else {
                            resultadoTrigonometrica = Math.sqrt(numTrigonometrica); // Calculamos la raíz cuadrada
                        }
                        break;
                    case 'valorAbsoluto':
                        resultadoTrigonometrica = Math.abs(numTrigonometrica); // Calculamos el valor absoluto
                        break;
                    case 'seno':
                        // Convertimos grados a radianes si el número ingresado está en grados
                        resultadoTrigonometrica = Math.sin(numTrigonometrica * (Math.PI / 180)); // Calculamos el seno
                        break;
                    case 'coseno':
                        // Convertimos grados a radianes si el número ingresado está en grados
                        resultadoTrigonometrica = Math.cos(numTrigonometrica * (Math.PI / 180)); // Calculamos el coseno
                        break;
                    case 'tangente':
                        // Convertimos grados a radianes si el número ingresado está en grados
                        resultadoTrigonometrica = Math.tan(numTrigonometrica * (Math.PI / 180)); // Calculamos la tangente
                        break;
                    case 'arcosenos':
                        resultadoTrigonometrica = Math.asin(numTrigonometrica) * (180 / Math.PI); // Calculamos el arco seno y convertimos a grados
                        break;
                    case 'arcocoseno':
                        resultadoTrigonometrica = Math.acos(numTrigonometrica) * (180 / Math.PI); // Calculamos el arco coseno y convertimos a grados
                        break;
                    case 'arcotangente':
                        resultadoTrigonometrica = Math.atan(numTrigonometrica) * (180 / Math.PI); // Calculamos el arco tangente y convertimos a grados
                        break;
                    case 'secante':
                        resultadoTrigonometrica = 1 / Math.cos(numTrigonometrica * (Math.PI / 180)); // Calculamos la secante
                        break;
                    case 'cosecante':
                        resultadoTrigonometrica = 1 / Math.sin(numTrigonometrica * (Math.PI / 180)); // Calculamos la cosecante
                        break;
                    case 'cotangente':
                        resultadoTrigonometrica = 1 / Math.tan(numTrigonometrica * (Math.PI / 180)); // Calculamos la cotangente
                        break;
                    default:
                        resultadoTrigonometrica = 'Operación no válida.'; // Manejo de operaciones no válidas
                }

                // Enviamos el resultado de vuelta al cliente
                socket.emit('resultadoTrigonometrica', resultadoTrigonometrica);
            });
        });
    //-----------------------------------------------------------------------------------------------------------------------------------------
    //-----------------------------------------------------------------------------------------------------------------------------------------
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
