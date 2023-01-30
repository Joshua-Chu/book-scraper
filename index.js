const puppeteer = require('puppeteer');
const fs = require('fs');

const FILENAME = 'data.json';
const BASE_URL = 'https://books.toscrape.com/';

const formatURL = (rawURL) => BASE_URL + rawURL.replace(/^(\.\.\/)+/, '');

const main = async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  await page.goto(BASE_URL);

  await page.exposeFunction('formatURL', formatURL);

  const URLs = await page.evaluate(() => {
    const categories = Array.from(
      document.querySelectorAll('.side_categories .nav ul li')
    );

    return Promise.all(
      categories.map(async (category) => ({
        categoryTitle: category.querySelector('a').innerText,
        categoryURL: await window.formatURL(
          category.querySelector('a').getAttribute('href')
        ),
      }))
    );
  });

  const result = [];
  for (let i = 0; i < URLs.length; i++) {
    const url = URLs[i];
    await page.goto(`${url.categoryURL}`);

    const nextButtonSelector = 'li.next a';
    const readySelector = '.page_inner';

    let categoryBooks = [];

    while (true) {
      await page.waitForSelector(readySelector);

      const data = await page.evaluate(() => {
        const books = Array.from(document.querySelectorAll('.product_pod'));

        const formatPrice = (price) => price.replace('£', '');

        const formatRating = (rating) => {
          switch (rating) {
            case 'One':
              return 1;
            case 'Two':
              return 2;
            case 'Three':
              return 3;
            case 'Four':
              return 4;
            case 'Five':
              return 5;
            default:
              return 0;
          }
        };

        const extractedData = Promise.all(
          books.map(async (book) => ({
            title: book.querySelector('h3 a')?.getAttribute('title') || '',
            rating: formatRating(
              book.querySelector('.star-rating').classList[1]
            ),
            price: formatPrice(
              book.querySelector('.product_price .price_color').innerHTML
            ),
            img: await window.formatURL(
              book.querySelector('img')?.getAttribute('src') || ''
            ),
          }))
        );

        return extractedData;
      });

      categoryBooks = categoryBooks.concat(data);

      if (!(await page.$(nextButtonSelector))) {
        break;
      }

      await page.click(nextButtonSelector);
    }

    result.push({
      category: url.categoryTitle,
      data: categoryBooks,
      numberOfItems: categoryBooks.length,
    });
  }
  await browser.close();

  if (fs.existsSync(FILENAME)) {
    fs.unlinkSync(FILENAME);
  }

  fs.writeFile(FILENAME, JSON.stringify(result), (err) => {
    if (err) throw err;

    console.log('Successfully saved data :)');
  });
};

main();
