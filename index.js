const loadJsonFile = require('load-json-file');
const vacancies = require('./vacancies.json');
const api_key = '1563de6cd1bea098b9af47d563ea8963dabb65c8441a7e786912f1d1452825906f57c545a7e02ab46a4df'


const VkBot = require('node-vk-bot-api');
const Markup = require('node-vk-bot-api/lib/markup')

const bot = new VkBot(api_key);

bot.command('/start', (ctx) => {
    ctx.reply('Если хочешь, я расскажу про вакансии.', null, Markup
        .keyboard([
            Markup.button({
                action: {
                    type: 'text', // Тип кнопки
                    label: 'Хочу посмотреть открытые вакансии!', // Текст
                    payload: JSON.stringify({
                        button: 'act1', // Полезная нагрузка на кнопку при нажатии её, вк будет передавать этот текст
                    }),
                },
                color: 'default', // цвет текста
            }),
            Markup.button({
                action: {
                    type: 'text', // Тип кнопки
                    label: 'Хочу поболтать с менеджером!', // Текст
                    payload: JSON.stringify({
                        button: 'act2', // Полезная нагрузка на кнопку при нажатии её, вк будет передавать этот текст
                    }),
                },
                color: 'default', // цвет текста
            }),
        ], { columns: 1 }).oneTime());
});

bot.command('Хочу посмотреть открытые вакансии!', async (ctx) => {
    let obj = loadJsonFile.sync('./vacancies.json');

    let varArr = [];

    for(let i = 0; i < obj.length; i++) {
        if(obj[i].is_reserve == false)
        {
            varArr.push(
                Markup.button({
                    action: {
                        type: 'text', // Тип кнопки
                        label: obj[i].name, // Текст
                        payload: JSON.stringify({
                            button: 'wer', // Полезная нагрузка на кнопку при нажатии её, вк будет передавать этот текст
                        }),
                    },
                    color: 'default', // цвет текста
                })
            )
        }
        console.log(obj[i].name)
    }

    try {
        await ctx.reply('testtest', null, Markup
        .keyboard(varArr, { columns: 1 }).oneTime());
    } catch (e) {
        console.error(e);
    }

});

bot.startPolling();
