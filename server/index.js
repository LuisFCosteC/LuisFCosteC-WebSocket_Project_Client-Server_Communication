import express from 'express'
import logger from 'morgan'
import { Server } from "socket.io";
import { createServer } from "node:http";

const port = process.env.PORT ?? 3000

const app = express()

// Se crea el servidor con HTTP
const server = createServer(app)
const io = new Server(server)

io.on('connection', (socket) => {
    console.log('');
    console.log('A user has connected!')

    socket.on('disconnect', () => {
        console.log('')
        console.log('An user has disconnected')
        console.log('');
    })

    socket.on('chat message', (msg) => {
        io.emit('chat message', msg)
    })
})

app.use(logger('dev'))

app.get('/', (req, res) => {
    res.sendFile(process.cwd() + '/client/index.html')
})

server.listen(port, () => {
    console.log('');
    console.log(`Server running on port ${port}`)
})