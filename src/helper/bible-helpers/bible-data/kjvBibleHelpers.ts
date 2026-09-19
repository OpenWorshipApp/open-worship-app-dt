import kjvBibleInfo from './kjvBibleInfo.json';
import kjvBibleBooks from './kjvBibleBooks.json';

export const basicKJVBibleData = {
    info: kjvBibleInfo as { [key: string]: any },
    books: kjvBibleBooks as { [key: string]: any },
};
