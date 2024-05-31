import { readFile } from 'fs/promises';
import initialize from 'extract-zip-rar';
import sharp from 'sharp';
import { initializeApp, cert } from 'firebase-admin/app';
import serviceAccount from './cert.json' assert { type: 'json' };
import { getStorage } from 'firebase-admin/storage';
import { getFirestore } from 'firebase-admin/firestore';

function log(msg) {
	console.log('===================================');
	console.log(msg);
	console.log('===================================');
}

const [, , archivePath] = process.argv;
const fullPath = new URL(archivePath, import.meta.url);

globalThis.wasmURL = new URL(
	'../node_modules/extract-zip-rar/dist/extract.wasm',
	import.meta.url
).toString();

log(`Reading file ${fullPath.toString()}`);
// the thing to do would be to maybe use fetch to get the local file as a ReadableStream, then pipe those bytes with a writable stream directly into Emscripten
const [module, file] = await Promise.all([initialize(), readFile(fullPath)]);
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
					buffer,
					free: () => {
						free_buffer(entry_data);
						free_buffer(buffer);
					}
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

log('Initializing Firebase...');
const app = initializeApp({
	credential: cert(serviceAccount),
	storageBucket: 'gs://web-reader-ae90f.appspot.com'
});

const bucket = getStorage(app).bucket();
const db = getFirestore(app);
const books = db.collection('books');
const pages = db.collection('pages');

const bytes = new Uint8Array(file);
const ptr = _malloc(file.length);
module.HEAPU8.set(bytes, ptr);

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
const iterator = readArchiveEntries({ file: { ptr, size: file.length }, extractData: true });

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

			// entry.free();
		} else {
			done = true;
		}
	});

	await Promise.all(operations);
	position += CHUNK_SIZE;
} while (!done);

log(`Creating book ${bookName}`);
const entries = [...readArchiveEntries({ file: { ptr, size: file.length } })].sort();
await books.add({
	name: bookName,
	length: entries.length,
	cover: entries[0].fileName,
	userId: USER_ID
});
