const articleCards = [
    {
        title: 'Article 1',
        category: 'Category 1',
        content: 'This is the content of article 1.'
    },
    {
        title: 'Article 2',
        category: 'Category 2',
        content: 'This is the content of article 2.'
    },
    {
        title: 'Article 3',
        category: 'Category 1',
        content: 'This is the content of article 3.'
    }
];

const cardContainer = document.querySelector('.card-container');

articleCards.forEach((article) => {
    const card = document.createElement('div');
    card.classList.add('card');
    card.innerHTML = `
        <h2>${article.title}</h2>
        <p>Category: ${article.category}</p>
        <p>${article.content}</p>
    `;
    cardContainer.appendChild(card);
});

const searchInput = document.getElementById('search-input');
const searchButton = document.getElementById('search-button');

searchButton.addEventListener('click', () => {
    const searchTerm = searchInput.value.toLowerCase();
    const filteredArticles = articleCards.filter((article) => article.title.toLowerCase().includes(searchTerm) || article.content.toLowerCase().includes(searchTerm));
    cardContainer.innerHTML = '';
    filteredArticles.forEach((article) => {
        const card = document.createElement('div');
        card.classList.add('card');
        card.innerHTML = `
            <h2>${article.title}</h2>
            <p>Category: ${article.category}</p>
            <p>${article.content}</p>
        `;
        cardContainer.appendChild(card);
    });
});

const categories = [...new Set(articleCards.map((article) => article.category))];
const categoriesList = document.querySelector('.categories ul');

categories.forEach((category) => {
    const listItem = document.createElement('li');
    listItem.textContent = category;
    categoriesList.appendChild(listItem);
});