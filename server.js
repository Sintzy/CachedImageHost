const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const c = require('colors')
const app = express();
const dir = './uploads';
var ficheirosenviados;
const port = 3001;

// Verificar se a pasta 'uploads' existe, caso contrário, criar
if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
}
fs.readdir(dir, (err, files) => {
    ficheirosenviados = files.length;
});
// Configuração do multer para upload de arquivos
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 2048 * 1024 * 1024 } // 2048mb (2gb)
});

// Função para gerar um código de 5 letras
const generateCode = () => {
    return crypto.randomBytes(3).toString('hex').substring(0, 5);
};

// Middleware para servir arquivos estáticos
app.use(express.static('public'));

// Função para enviar informações ao webhook do Discord
const sendToDiscord = async (data) => {
    const webhookUrl = 'https://discord.com/api/webhooks/1248605053997158481/KU-8ZS3U1Q3g2QGODZ9ybMXPjnn6t7svg6fB6gjU_yblQbIHHqoA1HhzhShlx45OVtfy';
    try {
        await axios.post(webhookUrl, data);
    } catch (error) {
        console.error('Erro ao enviar para o Discord:', error);
    }
};

// Endpoint para upload de arquivos
app.post('/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).send('Nenhum arquivo foi enviado.');
    }
    const code = generateCode();
    const filePath = req.file.path;
    const expireAt = Date.now() + 2191 * 60 * 60 * 1000; // 2191 horas = 3 messes

    // Armazenar informações do arquivo em um arquivo JSON
    let files = {};
    if (fs.existsSync('files.json')) {
        files = JSON.parse(fs.readFileSync('files.json', 'utf8'));
    }
    files[code] = { filePath, expireAt };
    fs.writeFileSync('files.json', JSON.stringify(files));

    res.redirect(`/upload-success.html?code=${code}`);
});

// Endpoint para servir a página de download
app.get('/download', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'download.html'));
});
app.get('/tos', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'tos.html'));
});
app.get('/whatiscached', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'whatiscached.html'));
});



    // Endpoint para processar o download com base no código
app.get('/downloadfile', (req, res) => {
    const code = req.query.code;
    if (!fs.existsSync('files.json')) {
        return res.sendFile(path.join(__dirname, 'public', 'errors/404.html'));
    }

    const files = JSON.parse(fs.readFileSync('files.json', 'utf8'));

    if (!files[code]) {
        return res.sendFile(path.join(__dirname, 'public', 'errors/404.html'));
    }

    const { filePath, expireAt } = files[code];
    if (Date.now() > expireAt) {
        fs.unlinkSync(filePath);
        delete files[code];
        fs.writeFileSync('files.json', JSON.stringify(files));
        return res.sendFile(path.join(__dirname, 'public', 'errors/expirou.html'));
    }

    res.download(filePath);
});

// Limpeza de arquivos expirados a cada hora
setInterval(() => {
    if (!fs.existsSync('files.json')) return;
    
    const files = JSON.parse(fs.readFileSync('files.json', 'utf8'));
    const now = Date.now();

    for (const code in files) {
        if (files[code].expireAt < now) {
            fs.unlinkSync(files[code].filePath);
            delete files[code];
        }
    }

    fs.writeFileSync('files.json', JSON.stringify(files));
}, 60 * 60 * 1000);

// Inicia o servidor
app.listen(port, () => {
    console.log(c.green(`[WEB] O servidor foi inciado na porta ${port}, com ${ficheirosenviados} ficheiros enviados.`));
});
