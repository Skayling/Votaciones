const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const PORT = process.env.PORT || 3000;
const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Conectar a MongoDB
mongoose.connect('mongodb://localhost:27017/votaciones')
    .then(() => console.log('Conectado a MongoDB'))
    .catch((err) => console.error('Error al conectar a MongoDB:', err));

// Definir esquema y modelo para el Comité
const comiteSchema = new mongoose.Schema({
    nombre: String,
    votos: {
        aFavor: { type: Number, default: 0 },
        enContra: { type: Number, default: 0 },
        abstencion: { type: Number, default: 0 }
    },
    maxVotos: { type: Number, default: 50 }
});
const Comite = mongoose.model('Comite', comiteSchema);

// Inicializar un único comité si no existe
async function inicializarComite() {
    const nombreComite = "Comité Único";
    const existe = await Comite.findOne({ nombre: nombreComite });
    if (!existe) {
        await Comite.create({ nombre: nombreComite });
    }
}
inicializarComite();

// Servir archivos estáticos desde la carpeta "public"
app.use(express.static(path.join(__dirname, 'public')));

// Ruta para servir el archivo HTML principal
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Ruta para exportar los resultados
app.get('/exportar', async (req, res) => {
    try {
        const comite = await Comite.findOne({ nombre: "Comité Único" });
        if (!comite) {
            return res.status(404).send('No se encontró el comité.');
        }

        const data = JSON.stringify({
            nombre: comite.nombre,
            votos: comite.votos
        }, null, 2);

        const filePath = path.join(__dirname, 'resultados.json');
        fs.writeFileSync(filePath, data);

        res.download(filePath, 'resultados.json', (err) => {
            if (err) {
                console.error('Error al descargar el archivo:', err);
            }
        });
    } catch (error) {
        console.error('Error al exportar los resultados:', error);
        res.status(500).send('Error al exportar los resultados.');
    }
});

// Almacenar los votos de cada cliente para prevenir votos repetidos
const votosClientes = {};

io.on('connection', (socket) => {
    console.log('Usuario conectado:', socket.id);

    // Enviar el estado del comité al conectarse
    async function enviarEstadoComite() {
        const comite = await Comite.findOne({ nombre: "Comité Único" });
        if (comite) {
            socket.emit('estadoComites', [comite]);  // Enviar comité único como lista
        }
    }
    enviarEstadoComite();

    // Manejar el evento de votación
    socket.on('votar', async (data) => {
        const { voto } = data;

        try {
            const comite = await Comite.findOne({ nombre: "Comité Único" });

            // Verificar si no se ha alcanzado el límite de votos
            const votosTotales = comite.votos.aFavor + comite.votos.enContra + comite.votos.abstencion;
            if (comite && votosTotales < comite.maxVotos && !votosClientes[socket.id]) {
                if (voto === 'A favor') {
                    comite.votos.aFavor++;
                } else if (voto === 'En contra') {
                    comite.votos.enContra++;
                } else if (voto === 'Abstención') {
                    comite.votos.abstencion++;
                }

                await comite.save();  // Guardar el estado actualizado en la base de datos

                // Registrar el voto del cliente para evitar duplicados
                votosClientes[socket.id] = true;

                // Emitir la actualización de votos para todos los clientes
                io.emit('actualizarVotos', { comiteId: comite._id, votos: comite.votos });
            } else {
                socket.emit('mensaje', 'No se puede emitir más votos para este comité o ya has votado.');
            }
        } catch (error) {
            console.error('Error al votar:', error);
        }
    });

    socket.on('disconnect', () => {
        console.log('Usuario desconectado:', socket.id);
        delete votosClientes[socket.id];
    });
});
app.get('/exportar', async (req, res) => {
    try {
        const comite = await Comite.findOne({ nombre: "Comité Único" });
        if (!comite) {
            return res.status(404).send('No se encontró el comité.');
        }

        const data = JSON.stringify({
            nombre: comite.nombre,
            votos: comite.votos
        }, null, 2);

        const filePath = path.join(__dirname, 'resultados.json');
        fs.writeFileSync(filePath, data);

        res.download(filePath, 'resultados.json', (err) => {
            if (err) {
                console.error('Error al descargar el archivo:', err);
            }
        });
    } catch (error) {
        console.error('Error al exportar los resultados:', error);
        res.status(500).send('Error al exportar los resultados.');
    }
});
// Evento para reiniciar los datos de votación a cero
io.on('connection', (socket) => {
    // Omitido: otros eventos

    socket.on('reiniciarVotaciones', async () => {
        try {
            const comite = await Comite.findOne({ nombre: "Comité Único" });
            if (comite) {
                // Reiniciar los votos
                comite.votos.aFavor = 0;
                comite.votos.enContra = 0;
                comite.votos.abstencion = 0;
                await comite.save();

                // Emitir el nuevo estado del comité a todos los clientes
                io.emit('estadoComites', [comite]); // Reenviar el estado actualizado del comité
                console.log('Votaciones reiniciadas.');
            }
        } catch (error) {
            console.error('Error al reiniciar votaciones:', error);
        }
    });
});

// Configuración del puerto
const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
