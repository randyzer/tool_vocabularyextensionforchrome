import sharp from 'sharp';

for (const size of [16, 32, 48, 128]) {
  await sharp('public/icon.svg')
    .resize(size, size)
    .png()
    .toFile(`public/icon-${size}.png`);
}
