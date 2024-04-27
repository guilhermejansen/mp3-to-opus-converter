import express from 'express';
import bodyParser from 'body-parser';
import fileUpload, { UploadedFile } from 'express-fileupload';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import axios from 'axios';
import { Readable } from 'stream';
import fs from 'fs';

const app = express();
const port = 5000;

app.use(bodyParser.json());
app.use(fileUpload());

ffmpeg.setFfmpegPath(ffmpegStatic!);

app.post('/convert', (req, res) => {
    if (!req.files || !req.files.audio) {
        return res.status(400).send('No file uploaded.');
    }

    const audioFile = req.files.audio as UploadedFile;
    const output = `output-${Date.now()}.opus`;

    const readableStream = new Readable();
    readableStream._read = () => {};
    readableStream.push(audioFile.data);
    readableStream.push(null);

    ffmpeg(readableStream)
        .addOption('-threads', '0')
        .audioCodec('libopus')
        .audioBitrate(128)
        .toFormat('opus')
        .on('end', () => {
            res.download(output, () => {
                fs.unlinkSync(output);
            });
        })
        .on('error', err => {
            res.status(500).send(err.message);
        })
        .save(output);
});

app.post('/convert-url', async (req, res) => {
    const { url } = req.body;
    if (!url) {
        return res.status(400).send('No URL provided.');
    }

    try {
        const response = await axios({
            url,
            responseType: 'arraybuffer'
        });

        const readable = new Readable();
        readable._read = () => {};
        readable.push(response.data);
        readable.push(null);

        const output = `output-${Date.now()}.opus`;

        ffmpeg(readable)
            .addOption('-threads', '0')
            .audioCodec('libopus')
            .audioBitrate(128)
            .toFormat('opus')
            .on('end', () => {
                res.download(output, () => {
                    fs.unlinkSync(output);
                });
            })
            .on('error', err => {
                res.status(500).send(err.message);
            })
            .save(output);
    } catch (error) {
        res.status(500).send('Failed to download or convert the file.');
    }
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
