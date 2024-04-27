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
    console.log('Received request to /convert endpoint');

    if (!req.files || !req.files.audio) {
        console.log('No file uploaded');
        return res.status(400).send('No file uploaded.');
    }

    const audioFile = req.files.audio as UploadedFile;
    console.log(`Handling file: ${audioFile.name}`);

    const readableStream = new Readable();
    readableStream._read = () => {};
    readableStream.push(audioFile.data);
    readableStream.push(null);

    console.log('Starting conversion process');
    const output = `output-${Date.now()}.opus`;

    ffmpeg(readableStream)
        .addOption('-threads', '0')
        .audioCodec('libopus')
        .audioBitrate(128)
        .toFormat('opus')
        .on('end', () => {
            console.log(`Conversion finished, streaming file: ${output}`);
            const stream = fs.createReadStream(output);
            stream.pipe(res);
            stream.on('close', () => {
                console.log(`Deleting file: ${output}`);
                fs.unlinkSync(output);
            });
        })
        .on('error', err => {
            console.log(`Conversion error: ${err.message}`);
            res.status(500).send(err.message);
        })
        .save(output);
});

app.post('/convert-url', async (req, res) => {
    const { url } = req.body;
    console.log(`Received request to /convert-url with URL: ${url}`);

    if (!url) {
        console.log('No URL provided');
        return res.status(400).send('No URL provided.');
    }

    try {
        console.log('Downloading file');
        const response = await axios({
            url,
            responseType: 'arraybuffer'
        });

        console.log('File downloaded, starting conversion');
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
                console.log(`Conversion finished, streaming file: ${output}`);
                const stream = fs.createReadStream(output);
                stream.pipe(res);
                stream.on('close', () => {
                    console.log(`Deleting file: ${output}`);
                    fs.unlinkSync(output);
                });
            })
            .on('error', err => {
                console.log(`Conversion error: ${err.message}`);
                res.status(500).send(err.message);
            })
            .save(output);
    } catch (error) {
        console.log(`Error downloading or converting file: ${error}`);
        res.status(500).send('Failed to download or convert the file.');
    }
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
