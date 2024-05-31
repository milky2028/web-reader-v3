import initialize from '../node_modules/extract-zip-rar/dist/extract.node.js';
import sharp from 'sharp';
import { initializeApp, cert } from 'firebase-admin/app';
import serviceAccount from './cert.json' assert { type: 'json' };
import { getStorage } from 'firebase-admin/storage';
import { getFirestore } from 'firebase-admin/firestore';
import { createReadStream } from 'fs';
import stream from 'node:stream';
import { stat } from 'fs/promises';

function log(msg) {
	console.log('===================================');
	console.log(msg);
	console.log('===================================');
}

const [, , archivePath] = process.argv;
const fullPath = new URL(archivePath, import.meta.url);

globalThis.wasmURL = new URL(
	'../node_modules/extract-zip-rar/dist/extract.node.wasm',
	import.meta.url
).toString();

log(`Reading file ${fullPath.toString()}`);
// the thing to do would be to maybe use fetch to get the local file as a ReadableStream, then pipe those bytes with a writable stream directly into Emscripten

const archiveSize = (await stat(fullPath)).size;
const readStream = stream.Readable.toWeb(createReadStream(fullPath));

const module = await initialize();
const {
	_malloc,
	open_archive,
	close_archive,
	get_next_entry,
	get_entry_name,
	entry_is_file,
	skip_extraction,
	get_buffer,
	read_entry_data,
	get_entry_size,
	free_buffer,
	END_OF_FILE,
	ENTRY_ERROR
} = module;

function isImage(path) {
	return path.endsWith('.jpg') || path.endsWith('.png');
}

function* readArchiveEntries({ file, extractData = false }) {
	const archivePtr = open_archive(file.ptr, file.size);

	for (;;) {
		const entryPtr = get_next_entry(archivePtr);
		if (entryPtr === END_OF_FILE || entryPtr === ENTRY_ERROR) {
			close_archive(archivePtr);
			yield null;
			break;
		}

		const path = get_entry_name(entryPtr).toLowerCase();
		const isFile = entry_is_file(entryPtr);

		if (isFile && !path.startsWith('__macosx') && isImage(path)) {
			const fileName = path.split('/').pop() ?? '';
			if (extractData) {
				const size = get_entry_size(entryPtr);
				const entry_data = read_entry_data(archivePtr, entryPtr);
				const buffer = get_buffer(entry_data, size);

				yield {
					fileName,
					buffer: buffer.slice(),
					free: () => free_buffer(entry_data)
				};
			} else {
				yield { fileName };
			}
		} else if (extractData) {
			skip_extraction(archivePtr);
		}
	}
}

function range({ end, start = 0, step = 1 }) {
	const numbers = [];
	for (let i = start; i < end; i += step) {
		numbers.push(i);
	}

	return numbers;
}

function createEmscriptenStream(startingOffset) {
	let position = 0;

	return new WritableStream({
		write(chunk) {
			module.HEAPU8.set(chunk, startingOffset + position);
			position += chunk.byteLength;
		}
	});
}

const ptr = _malloc(archiveSize);
await readStream.pipeTo(createEmscriptenStream(ptr));

log('Initializing Firebase...');
const app = initializeApp({
	credential: cert(serviceAccount),
	storageBucket: 'gs://web-reader-ae90f.appspot.com'
});

const bucket = getStorage(app).bucket();
const db = getFirestore(app);
const books = db.collection('books');
const pages = db.collection('pages');

const bookName = decodeURIComponent(
	fullPath
		.toString()
		.split('/')
		.pop()
		.replace(/.cbr|.cbz|.zip|.rar/g, '')
);

const USER_ID = 'P1rHmhJ80KOevyB3EmxkyyEzUGj1';
const CHUNK_SIZE = 15;

log('Enumerating archive...');
const iterator = readArchiveEntries({ file: { ptr, size: archiveSize }, extractData: true });

let done = false;
let position = 0;
do {
	const operations = range({ start: position, end: position + CHUNK_SIZE }).map(async () => {
		const entry = iterator.next().value;
		if (entry) {
			const path = `${USER_ID}/${bookName}/${entry.fileName}`;
			log(`Uploading to ${path}...`);

			const optimizedBuffer = await sharp(entry.buffer)
				.jpeg({ mozjpeg: true, quality: 75 })
				.toBuffer();

			await Promise.all([
				bucket.file(path).save(optimizedBuffer),
				pages.add({
					name: entry.fileName,
					book: bookName,
					path: encodeURIComponent(path),
					userId: USER_ID
				})
			]);

			entry.free();
		} else {
			done = true;
		}
	});

	await Promise.all(operations);
	position += CHUNK_SIZE;
} while (!done);

log(`Creating book ${bookName}`);
const entries = [...readArchiveEntries({ file: { ptr, size: archiveSize } })].sort();
await books.add({
	name: bookName,
	length: entries.length,
	cover: entries[0].fileName,
	userId: USER_ID
});
