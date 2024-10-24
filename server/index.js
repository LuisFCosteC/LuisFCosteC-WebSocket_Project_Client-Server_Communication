import express from 'express'
import logger from 'morgan'

const port = process.env.PORT ?? 3000

const app = express()

app.use(logger('dev'))

app.get('/', (req, res) => {
    res.send('<h1>This is Chat</h1>')
})

app.listen(port, () => {
  console.log(`Server runing on port ${port}`)
})