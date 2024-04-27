import express, { Request, Response, NextFunction } from 'express';
import bodyParser from 'body-parser';
import fileUpload, { UploadedFile } from 'express-fileupload';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import axios from 'axios';
import { Readable } from 'stream';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = 5000;

app.use(bodyParser.json());
app.use(fileUpload());

ffmpeg.setFfmpegPath(ffmpegStatic!);

app.get('/', (req: Request, res: Response) => {
    res.json({
        message: "API está online",
        endpoints: {
            convert: "/convert - POST para converter arquivos de áudio para formato opus",
            convertUrl: "/convert-url - POST para baixar e converter áudio de URL para formato opus",
            health: "/health - GET para verificar a saúde da API"
        }
    });
});

app.use((req: Request, res: Response, next: NextFunction) => {
    if (['/health', '/'].includes(req.path)) {
        return next();
    }
    const apiSecretKey = process.env.API_SECRET_KEY;
    const authHeader = req.headers.authorization;

    if (!authHeader || authHeader !== `Bearer ${apiSecretKey}`) {
        return res.status(401).json({ message: 'Não autorizado' });
    }
    next();
});

app.post('/convert', (req, res) => {
    console.log('Recebido pedido para o endpoint /convert');

    if (!req.files || !req.files.audio) {
        console.log('Nenhum arquivo enviado');
        return res.status(400).send('Nenhum arquivo enviado.');
    }

    const audioFile = req.files.audio as UploadedFile;
    console.log(`Manipulando arquivo: ${audioFile.name}`);

    const readableStream = new Readable();
    readableStream._read = () => { };
    readableStream.push(audioFile.data);
    readableStream.push(null);

    console.log('Iniciando processo de conversão');
    const output = `output-${Date.now()}.opus`;

    ffmpeg(readableStream)
        .addOption('-threads', '0')
        .audioCodec('libopus')
        .audioBitrate(128)
        .toFormat('opus')
        .on('end', () => {
            console.log(`Conversão concluída, preparando para enviar o arquivo: ${output}`);
            const stream = fs.createReadStream(output);

            // Listen to the 'close' event to delete the file afterwards
            stream.on('close', () => {
                console.log(`Arquivo deletado: ${output}`);
                fs.unlinkSync(output);
            });

            // Stream the file in the response
            res.setHeader('Content-Type', 'audio/opus');
            res.setHeader('Content-Disposition', `attachment; filename=${output}`);
            stream.pipe(res);
        })
        .on('error', err => {
            console.log(`Erro na conversão: ${err.message}`);
            res.status(500).send(err.message);
        })
        .save(output);
});

app.post('/convert-url', async (req, res) => {
    const { url } = req.body;
    console.log(`Recebido pedido para o endpoint /convert-url com URL: ${url}`);

    if (!url) {
        console.log('Nenhuma URL fornecida');
        return res.status(400).send('Nenhuma URL fornecida.');
    }

    try {
        console.log('Baixando arquivo');
        const response = await axios({
            url,
            responseType: 'arraybuffer'
        });

        console.log('Arquivo baixado, iniciando conversão');
        const readable = new Readable();
        readable._read = () => { };
        readable.push(response.data);
        readable.push(null);

        const output = `output-${Date.now()}.opus`;

        ffmpeg(readable)
            .addOption('-threads', '0')
            .audioCodec('libopus')
            .audioBitrate(128)
            .toFormat('opus')
            .on('end', () => {
                console.log(`Conversão concluída, preparando para enviar o arquivo: ${output}`);
                fs.stat(output, (err, stats) => {
                    if (err) {
                        return res.status(500).send('Erro ao obter estatísticas do arquivo.');
                    }

                    const fileInfo = {
                        data: {
                            'File Name': output,
                            'runData.directory': 'v1/text-to-speech',
                            'File Extension': 'opus',
                            'Mime Type': 'audio/opus',
                            'File Size': `${stats.size} bytes`
                        }
                    };

                    res.json(fileInfo);

                    console.log(`Arquivo deletado: ${output}`);
                    fs.unlinkSync(output);
                });
            })
            .on('error', err => {
                console.log(`Erro na conversão: ${err.message}`);
                res.status(500).send(err.message);
            })
            .save(output);
    } catch (error) {
        console.log(`Erro ao baixar ou converter o arquivo: ${error}`);
        res.status(500).send('Falha ao baixar ou converter o arquivo.');
    }
});

app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

app.listen(port, () => {
    console.log(`Servidor rodando na porta ${port}`);
});
