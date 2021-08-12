const loadJsonFile = require('load-json-file');
const path = require('path')
const fetch = require('node-fetch');
const jsdom = require("jsdom");
const archiver = require('archiver');
const iconv = require('iconv-lite');
const fs = require('fs');
var request = require('request');
var FormData = require('form-data');
const easyvk = require('easyvk');
const cheerio = require('cheerio')
const rest = require('restler');
const parser = require('node-html-parser');
const $ = require("jquery");
const Readable = require('stream').Readable;
const nodemailer = require('nodemailer')

const HTML = require('html-parse-stringify')

const vacancies = require('./vacancies.json');
const api_key = '1563de6cd1bea098b9af47d563ea8963dabb65c8441a7e786912f1d1452825906f57c545a7e02ab46a4df'

const VkBot = require('node-vk-bot-api');
const Markup = require('node-vk-bot-api/lib/markup');
const Session = require('node-vk-bot-api/lib/session');
const Scene = require('node-vk-bot-api/lib/scene');
const Stage = require('node-vk-bot-api/lib/stage');
const { format } = require('path');

const bot = new VkBot(api_key);

let CHOOSEN_ID = 0;
let CHOOSEN_NAME = "";

// айди ВК страницы менеджера. Можно сделать чтобы их несколько было. Это цифры в ссылке на страницу, либо можно узнать в настройках аккаунта.
const MANAGER_ID = 392828943;

const scene = new Scene('deal',
    (ctx) => {
        ctx.scene.next();
        //    console.log(ctx.message.from_id)
        ctx.session.from_id = ctx.message.from_id.toString()
        ctx.reply('Отлично! Оставь контактную информацию, чтобы мы могли с тобой связаться. Сначала напиши сюда своё ФИО.');
    },
    (ctx) => {
        ctx.session.fullname = ctx.message.text;

        ctx.scene.next();
        ctx.reply('Теперь напиши свою почту.');
    },
    (ctx) => {
        ctx.session.email = ctx.message.text;

        ctx.scene.next();
        ctx.reply('Еще чуть-чуть! Оставь свой номер телефона.');
    },
    (ctx) => {
        ctx.session.number = ctx.message.text;

        ctx.scene.next();
        ctx.reply('Хочу узнать тебя получше! Напиши пару слов о себе.');
    },
    (ctx) => {
        ctx.session.description = ctx.message.text;
        ctx.reply('Теперь тестовое задание. Что решаешь? Посмотришь?', null, Markup
            .keyboard([
                Markup.button({
                    action: {
                        type: 'text',
                        label: 'Хочу ТЗ!',
                        payload: JSON.stringify({
                            button: 'act1',
                        }),
                    },
                    color: 'positive',
                }),
                Markup.button({
                    action: {
                        type: 'text',
                        label: 'Не хочу',
                        payload: JSON.stringify({
                            button: 'act1',
                        }),
                    },
                    color: 'negative',
                }),
            ], { columns: 1 }).oneTime());
        ctx.scene.leave();
    },
);

const session = new Session();
const stage_deal = new Stage(scene);

bot.use(session.middleware());
bot.use(stage_deal.middleware());

bot.command('Я в деле!', (ctx) => {
    ctx.scene.enter('deal');
});

const scene_tz = new Scene('want_tz',
    (ctx) => {
        ctx.reply('Окей, держи тестовое задание. Его нужно сделать за 5 рабочий дней. Дерзай! Буду ждать!');

        let obj = loadJsonFile.sync('./vacancies.json');

        let filesArray = [];

        for (let i = 0; i < obj.length; i++) {
            if (obj[i].name == ctx.session.choosen_name) {
                for (let j = 0; j < obj[i].files.length; j++) {
                    if (obj[i].files[j].file_name.split(".")[1] != "html") {
                        filesArray.push(obj[i].files[j]);
                    }
                }
            }
        }

        for (let k = 0; k < filesArray.length; k++) {
            let buff = Buffer.from(filesArray[k].content.toString(), 'base64')

            var s = new Readable()

            s.push(buff)
            s.push(null)

            s.pipe(fs.createWriteStream(filesArray[k].file_name.toString()));

            easyvk({
                token: api_key,
                utils: {
                    longpoll: true
                }
            }).then(async vk => {

                const lpSettings = {
                    forGetLongPollServer: {
                        lp_version: 3, // Изменяем версию LongPoll, в EasyVK используется версия 2
                        need_pts: 1
                    },
                    forLongPollServer: {
                        wait: 15 // Ждем ответа 15 секунд
                    }
                }

                async function uploadServerGet(peer_id) {
                    return vk.call("docs.getMessagesUploadServer", {
                        type: "doc",
                        peer_id: peer_id,
                    })
                }

                async function saveDoc(user, random, peer_id, message, attachment) {
                    return vk.call("messages.send", {
                        user_id: user,
                        random_id: random,
                        peer_id: user,
                        message: message,
                        attachment: attachment
                    })
                }

                let serv = await uploadServerGet(ctx.session.from_id)
                let server = vk.uploader;
                let url = serv.upload_url

                server.upload({
                    getUrlMethod: "docs.getMessagesUploadServer",
                    getUrlParams: {
                        type: "doc",
                        peer_id: ctx.session.from_id,
                    },
                    saveMethod: "docs.save",
                    saveParams: {
                        file: url,
                        title: filesArray[k].file_name,
                        tags: "no_tags",
                        return_tags: 0
                    },
                    file: filesArray[k].file_name,
                }).then(async res => {
                    await saveDoc(ctx.session.from_id, easyvk.randomId(), ctx.session.from_id, "Тестовое задание на позицию '" + ctx.session.choosen_name + "'", "doc" + res.doc.url.split("doc")[1].split('?')[0].toString())
                })
            })
        }

        easyvk({
            token: api_key,
            utils: {
                longpoll: true
            }
        }).then(async vk => {

            const lpSettings = {
                forGetLongPollServer: {
                    lp_version: 3, // Изменяем версию LongPoll, в EasyVK используется версия 2
                    need_pts: 1
                },
                forLongPollServer: {
                    wait: 15 // Ждем ответа 15 секунд
                }
            }

            const random = (min, max) => Math.floor(Math.random() * (max - min)) + min;

            await vk.call("messages.send", {
                user_id: MANAGER_ID,
                random_id: random(1, 100000),
                peer_id: MANAGER_ID,
                message: "Пользователь https://vk.com/id" + ctx.session.from_id + " оставил заявку по вакансии '" + ctx.session.choosen_name
                    + "'. Информация:\nФИО: " + ctx.session.fullname + "\nE-mail: " + ctx.session.email + "\nТелефон: " + ctx.session.number.toString() + "\nСопроводительная информация: "
                    + ctx.session.description + "\nПользователю было выслано тестовое задание."
            })

            // let testEmailAccount = await nodemailer.createTestAccount()

            let transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    user: 'vladislav0161@gmail.com',
                    pass: 'Vladik123',
                },
            })

            await transporter.sendMail({
                from: '"Чат-бот "Вакансии" <vladislav0161@gmail.com>',
                to: 'vladislav0151@bk.ru',
                subject: 'Заявка по вакансии "' + ctx.session.choosen_name + '"',
                text: "Пользователь https://vk.com/id" + ctx.session.from_id + " оставил заявку по вакансии '" + ctx.session.choosen_name
                    + "'. Информация:\nФИО: " + ctx.session.fullname + "\nE-mail: " + ctx.session.email + "\nТелефон: " + ctx.session.number.toString() + "\nСопроводительная информация: "
                    + ctx.session.description + "\nПользователю было выслано тестовое задание.",
                html:
                    '<div>Пользователь <strong>https://vk.com/id' + ctx.session.from_id + ' </strong>оставил заявку по вакансии <i>' + ctx.session.choosen_name + '</i>. Информация:</div></br>' +
                    '<div> <strong>ФИО: </strong>' + ctx.session.fullname + '</div></br>' +
                    '<div> <strong>E-mail: </strong>' + ctx.session.email + '</div></br>' +
                    '<div> <strong>Номер телефона: </strong>' + ctx.session.number.toString() + '</div></br>' +
                    '<div> <strong>Сопроводительная информация: </strong>' + ctx.session.description + '</div></br>' +
                    '<div>Пользователю было выслано тестовое задание.</strong> </div>'
            })
        })

        ctx.reply('Если хочешь поговорить ещё, нажми на кнопку "Начать" или напиши "начать" в чат.', null, Markup
            .keyboard([
                Markup.button({
                    action: {
                        type: 'text',
                        label: 'Начать',
                        payload: JSON.stringify({
                            button: 'act1',
                        }),
                    },
                    color: 'positive',
                }),
            ], { columns: 1 }).oneTime());
        ctx.scene.leave();
    }
);

const stage_tz = new Stage(scene_tz);
bot.use(stage_tz.middleware());

bot.command('Хочу ТЗ!', (ctx) => {
    ctx.scene.enter('want_tz');
});

bot.command(['/start', 'Начать', 'start', 'Start', 'начать', 'Старт', 'старт', 'В начало'], (ctx) => {
    ctx.reply('Если хочешь, я расскажу про вакансии.', null, Markup
        .keyboard([
            Markup.button({
                action: {
                    type: 'text',
                    label: 'Хочу посмотреть открытые вакансии!',
                    payload: JSON.stringify({
                        button: 'act1',
                    }),
                },
                color: 'primary',
            }),
            Markup.button({
                action: {
                    type: 'text',
                    label: 'Хочу поболтать с менеджером!',
                    payload: JSON.stringify({
                        button: 'act2',
                    }),
                },
                color: 'primary',
            }),
        ], { columns: 1 }).oneTime());
});

const scene_manager = new Scene('manager',
    async (ctx) => {
        try {
            ctx.scene.next();
            easyvk({
                token: api_key,
                utils: {
                    longpoll: true
                }
            }).then(async vk => {

                const lpSettings = {
                    forGetLongPollServer: {
                        lp_version: 3, // Изменяем версию LongPoll, в EasyVK используется версия 2
                        need_pts: 1
                    },
                    forLongPollServer: {
                        wait: 15 // Ждем ответа 15 секунд
                    }
                }

                async function getMessage(msgArray = []) {
                    const MESSAGE_ID__INDEX = 1;

                    return vk.call('messages.getById', {
                        message_ids: msgArray[MESSAGE_ID__INDEX]
                    })
                }

                async function sendMessageToManager(user, random, peer, mess) {
                    return vk.call("messages.send", {
                        user_id: user,
                        random_id: random,
                        peer_id: peer,
                        message: mess
                    })
                }

                const random = (min, max) => Math.floor(Math.random() * (max - min)) + min;

                vk.longpoll.connect(lpSettings).then((lpcon) => {
                    let flag = true;
                    lpcon.on("message", async (msg) => {
                        let fullMessage = await getMessage(msg);
                        fullMessage = fullMessage.items[0]
                        while (flag) {
                            await sendMessageToManager(MANAGER_ID, random(1, 100000), MANAGER_ID, "Пользователь https://vk.com/id" + fullMessage.peer_id.toString() + " хочет пообщаться с менеджером по поводу вакансий.")
                            flag = false
                        }
                    })
                })
            })

            let transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    user: 'vladislav0161@gmail.com',
                    pass: 'Vladik123',
                },
            })

            await transporter.sendMail({
                from: '"Чат-бот "Вакансии" <vladislav0161@gmail.com>',
                to: 'vladislav0151@bk.ru',
                subject: 'Заявка от пользователя',
                text: "Пользователь https://vk.com/id" + ctx.message.from_id.toString() + " хочет поговорить с менеджером.",
                html:
                    '<div>Пользователь <strong>https://vk.com/id' + ctx.message.from_id.toString() + ' </strong> хочет поговорить с менеджером.</div>'
            })

            await ctx.reply('Я передала твою страницу ВК менеджеру, он обязательно тебе ответит!');
            await ctx.reply('Если хочешь поговорить ещё, нажми на кнопку "Начать" или напиши "начать" в чат.', null, Markup
                .keyboard([
                    Markup.button({
                        action: {
                            type: 'text',
                            label: 'Начать',
                            payload: JSON.stringify({
                                button: 'act1',
                            }),
                        },
                        color: 'positive',
                    }),
                ], { columns: 1 }).oneTime());
            ctx.scene.leave();
        } catch (e) {
            console.error(e);
        }
    },
);
const stage_manager = new Stage(scene_manager);
bot.use(stage_manager.middleware());

bot.command('Хочу поболтать с менеджером!', async ctx => {
    ctx.scene.enter('manager');
});

bot.command(['Я пас.', 'Назад к вакансиям кадрового резерва'], async (ctx) => {
    let obj = loadJsonFile.sync('./vacancies.json');

    let varArr = [];

    let fullArr = [];

    for (let i = 0; i < obj.length; i++) {

        if (obj[i].is_reserve == true) {

            fullArr.push({
                id: obj[i].id,
                name: obj[i].name,
                is_reserve: obj[i].is_reserve,
                files: obj[i].files ? obj[i].files : null
            })

            varArr.push(
                Markup.button({
                    action: {
                        type: 'text', // Тип кнопки
                        label: obj[i].name, // Текст
                        payload: JSON.stringify({
                            button: 'act8',
                        }),
                    },
                    color: 'primary', // цвет текста
                })
            )

        }
        console.log(obj[i].name)
    }

    varArr.push(
        Markup.button({
            action: {
                type: 'text', // Тип кнопки
                label: 'В начало', // Текст
                payload: JSON.stringify({
                    button: 'wer', // Полезная нагрузка на кнопку при нажатии её, вк будет передавать этот текст
                }),
            },
            color: 'positive', // цвет текста
        })
    )

    for (let i = 0; i < fullArr.length; i++) {
        bot.command(fullArr[i].name.toString(), async ctx => {
            // let EEE = "";
            try {

                let IF_HTML = false;
                let HTML_POS = 0;

                for (let q = 0; q < fullArr[i].files.length; q++) {
                    if (fullArr[i].files[q].file_name.split(".")[1] == 'html') {
                        IF_HTML = true;
                        HTML_POS = q;
                    }
                }

                console.log(IF_HTML, HTML_POS)

                if (IF_HTML) {
                    let buff = Buffer.from(fullArr[i].files[HTML_POS].content.toString(), 'base64');

                    fs.writeFile(fullArr[i].files[HTML_POS].file_name.toString(), buff, async function (error) {
                        if (error) throw error; // если возникла ошибка
                        let data = fs.readFileSync(fullArr[i].files[HTML_POS].file_name.toString(), "binary");
                        var output = iconv.decode(data, "windows-1251").toString();

                        var span = new jsdom.JSDOM().window.document.createElement('span');

                        span.innerHTML = output;

                        span.innerHTML = span.innerHTML.replace(/\n{2,}/g, "\n\n");
                        //span.innerHTML = span.innerHTML.replace(/;/g, ";\n");

                        //span.innerHTML = span.innerHTML.replace(/\s{2,}/g, " ");
                        span.innerHTML = span.innerHTML.replace(/\n\s/g, "\n");

                        let arr = span.innerHTML.split('');

                        for (let i = 1; i < arr.length - 1; i++) {
                            if (arr[i] == "\n" && arr[i - 1].match(/[\p{Alpha}\p{M}\p{Nd}\p{Pc}\p{Join_C}-]/gu) && arr[i + 1].match(/[\p{Alpha}\p{M}\p{Nd}\p{Pc}\p{Join_C}-]/gu)) {
                                arr[i] = " ";
                            }
                            if (arr[i] == "\n" && arr[i + 1].match(/\s{1}/g) || arr[i] == " " && arr[i + 1].match(/\n{1}/g)) {
                                arr[i + 1] = "";
                                i++;
                            }
                            if (arr[i] == " " && arr[i + 1] == " ") {
                                arr[i] = "";
                            }
                        }

                        span.innerHTML = arr.join('');

                        let VACATION_TEXT = span.textContent.split("-->")[1] != undefined ? span.textContent.split("-->")[1].trim() : span.textContent.trim()

                        await ctx.reply(VACATION_TEXT.toString());

                        ctx.session.choosen_id = fullArr[i].id;
                        ctx.session.choosen_name = fullArr[i].name;

                        await ctx.reply('Вот информация о вакансии. Заинтересовало?', null, Markup
                            .keyboard([
                                Markup.button({
                                    action: {
                                        type: 'text',
                                        label: 'Я в деле!',
                                        payload: JSON.stringify({
                                            button: 'act1',
                                        }),
                                    },
                                    color: 'positive',
                                }),
                                Markup.button({
                                    action: {
                                        type: 'text',
                                        label: 'Назад к вакансиям кадрового резерва',
                                        payload: JSON.stringify({
                                            button: 'act2',
                                        }),
                                    },
                                    color: 'primary',
                                }),
                            ], { columns: 1 }).oneTime());
                    });
                }
                else {
                    await ctx.reply('Описания пока нет 😔', null, Markup
                        .keyboard([
                            Markup.button({
                                action: {
                                    type: 'text',
                                    label: 'В начало',
                                    payload: JSON.stringify({
                                        button: 'act1',
                                    }),
                                },
                                color: 'positive',
                            }),
                        ], { columns: 1 }).oneTime());
                }

            } catch (e) {
                console.error(e);
            }
        });
    }
    try {
        await ctx.reply('Жаль. Но у меня есть еще вариант для тебя! Предлагаю вакансии кадрового резерва.', null, Markup
            .keyboard(varArr, { columns: 2 }).oneTime(true));
    } catch (e) {
        console.error(e);
    }
})


bot.command(['Хочу посмотреть открытые вакансии!', 'Назад к открытым вакансиям'], async (ctx) => {
    let obj = loadJsonFile.sync('./vacancies.json');

    let varArr = [];

    let fullArr = [];

    for (let i = 0; i < obj.length; i++) {

        if (obj[i].is_reserve == false) {

            fullArr.push({
                id: obj[i].id,
                name: obj[i].name,
                is_reserve: obj[i].is_reserve,
                files: obj[i].files ? obj[i].files : null
            })
            varArr.push(
                Markup.button({
                    action: {
                        type: 'text', // Тип кнопки
                        label: obj[i].name, // Текст
                        payload: JSON.stringify({
                            button: 'act3',
                        }),
                    },
                    color: 'primary', // цвет текста
                })
            )

        }
        console.log(obj[i].name)
    }

    varArr.push(
        Markup.button({
            action: {
                type: 'text', // Тип кнопки
                label: 'Я пас.', // Текст
                payload: JSON.stringify({
                    button: 'wer', // Полезная нагрузка на кнопку при нажатии её, вк будет передавать этот текст
                }),
            },
            color: 'negative', // цвет текста
        })
    )

    varArr.push(
        Markup.button({
            action: {
                type: 'text', // Тип кнопки
                label: 'В начало', // Текст
                payload: JSON.stringify({
                    button: 'wer', // Полезная нагрузка на кнопку при нажатии её, вк будет передавать этот текст
                }),
            },
            color: 'positive', // цвет текста
        })
    )

    for (let i = 0; i < fullArr.length; i++) {
        bot.command(fullArr[i].name.toString(), async ctx => {
            // let EEE = "";
            try {

                let IF_HTML = false;
                let HTML_POS = 0;

                for (let q = 0; q < fullArr[i].files.length; q++) {
                    if (fullArr[i].files[q].file_name.split(".")[1] == 'html') {
                        IF_HTML = true;
                        HTML_POS = q;
                    }
                }

                console.log(IF_HTML, HTML_POS)

                if (IF_HTML) {
                    let buff = Buffer.from(fullArr[i].files[HTML_POS].content.toString(), 'base64');

                    fs.writeFile(fullArr[i].files[HTML_POS].file_name.toString(), buff, async function (error) {
                        if (error) throw error; // если возникла ошибка
                        let data = fs.readFileSync(fullArr[i].files[HTML_POS].file_name.toString(), "binary");
                        var output = iconv.decode(data, "windows-1251").toString();

                        var span = new jsdom.JSDOM().window.document.createElement('span');

                        span.innerHTML = output;

                        let arr = span.innerHTML.split('');

                        for (let i = 1; i < arr.length - 1; i++) {
                            if (arr[i] == "\n" && arr[i - 1].match(/[\p{Alpha}\p{M}\p{Nd}\p{Pc}\p{Join_C}-]/gu) && arr[i + 1].match(/[\p{Alpha}\p{M}\p{Nd}\p{Pc}\p{Join_C}-]/gu)) {
                                arr[i] = " ";
                            }
                            if (arr[i] == "\n" && arr[i + 1].match(/\s{1}/g)) {
                                arr[i + 1] = "";
                                i++;
                            }
                            if (arr[i] == " " && arr[i + 1].match(/\n{1}/g)) {
                                arr[i + 1] = "";
                                i++;
                            }
                            if (arr[i] == " " && arr[i + 1] == " ") {
                                arr[i] = "";
                            }
                        }

                        span.innerHTML = arr.join('');

                        span.innerHTML = span.innerHTML.replace(/\n{2,}/g, "\n\n");

                        span.innerHTML = span.innerHTML.replace(/\n{2,}/g, "\n\n");

                        span.innerHTML = span.innerHTML.replace(/\n\s/g, "\n");

                        ctx.session.choosen_id = fullArr[i].id;
                        ctx.session.choosen_name = fullArr[i].name;

                        let VACATION_TEXT = span.textContent.split("-->")[1] != undefined ? span.textContent.split("-->")[1].trim() : span.textContent.trim()

                        await ctx.reply(VACATION_TEXT.toString());

                        await ctx.reply('Вот информация о вакансии. Заинтересовало?', null, Markup
                            .keyboard([
                                Markup.button({
                                    action: {
                                        type: 'text',
                                        label: 'Я в деле!',
                                        payload: JSON.stringify({
                                            button: 'deal',
                                        }),
                                    },
                                    color: 'positive',
                                }),
                                Markup.button({
                                    action: {
                                        type: 'text',
                                        label: 'Назад к открытым вакансиям',
                                        payload: JSON.stringify({
                                            button: 'act2',
                                        }),
                                    },
                                    color: 'primary',
                                }),
                            ], { columns: 1 }).oneTime());
                    });
                }
                else {
                    await ctx.reply('Описания пока нет :(', null, Markup
                        .keyboard([
                            Markup.button({
                                action: {
                                    type: 'text',
                                    label: 'В начало',
                                    payload: JSON.stringify({
                                        button: 'act1',
                                    }),
                                },
                                color: 'positive',
                            }),
                        ], { columns: 1 }).oneTime());
                }

            } catch (e) {
                console.error(e);
            }
        });
    }

    try {
        await ctx.reply('Класс! Вот наши вакансии, выбирай понравившуюся 😉', null, Markup
            .keyboard(varArr, { columns: 1 }).oneTime(true));
    } catch (e) {
        console.error(e);
    }

});

bot.command('Не хочу', async (ctx) => {
    await ctx.reply('Отлично пообщались! Удачного поиска работы.');

    try {
        easyvk({
            token: api_key,
            utils: {
                longpoll: true
            }
        }).then(async vk => {

            const random = (min, max) => Math.floor(Math.random() * (max - min)) + min;

            await vk.call("messages.send", {
                user_id: MANAGER_ID,
                random_id: random(1, 100000),
                peer_id: MANAGER_ID,
                message: "Пользователь https://vk.com/id" + ctx.session.from_id + " оставил заявку по вакансии '" + ctx.session.choosen_name
                    + "'. Информация:\nФИО: " + ctx.session.fullname + "\nE-mail: " + ctx.session.email + "\nТелефон: " + ctx.session.number.toString() + "\nСопроводительная информация: "
                    + ctx.session.description + "\nПользователь отказался от получения тестового задания."
            })

            let transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    user: 'vladislav0161@gmail.com',
                    pass: 'Vladik123',
                },
            })

            await transporter.sendMail({
                from: '"Чат-бот "Вакансии" <vladislav0161@gmail.com>',
                to: 'vladislav0151@bk.ru',
                subject: 'Заявка по вакансии "' + ctx.session.choosen_name + '"',
                text: "Пользователь https://vk.com/id" + ctx.session.from_id + " оставил заявку по вакансии '" + ctx.session.choosen_name
                    + "'. Информация:\nФИО: " + ctx.session.fullname + "\nE-mail: " + ctx.session.email + "\nТелефон: " + ctx.session.number.toString() + "\nСопроводительная информация: "
                    + ctx.session.description + "\nПользователю было выслано тестовое задание.",
                html:
                    '<div>Пользователь <strong>https://vk.com/id' + ctx.session.from_id + ' </strong>оставил заявку по вакансии <i>' + ctx.session.choosen_name + '</i>. Информация:</div></br>' +
                    '<div> <strong>ФИО: </strong>' + ctx.session.fullname + '</div></br>' +
                    '<div> <strong>E-mail: </strong>' + ctx.session.email + '</div></br>' +
                    '<div> <strong>Номер телефона: </strong>' + ctx.session.number.toString() + '</div></br>' +
                    '<div> <strong>Сопроводительная информация: </strong>' + ctx.session.description + '</div></br>' +
                    '<div>Пользователь отказался от тестового задания.</strong> </div>'
            })
        })

        await ctx.reply('Если хочешь пообщаться ещё, напиши "Начать", либо нажми на кнопку.', null, Markup
            .keyboard([
                Markup.button({
                    action: {
                        type: 'text',
                        label: 'Начать',
                        payload: JSON.stringify({
                            button: 'act1',
                        }),
                    },
                    color: 'positive',
                }),
            ], { columns: 1 }).oneTime());
    } catch (e) {
        console.error(e);
    }
})

bot.command(['/stop', 'Stop', 'stop', 'Стоп', 'стоп'], async (ctx) => {
    await ctx.reply('До скорого!', null, Markup
        .keyboard([
            Markup.button({
                action: {
                    type: 'text',
                    label: 'Начать',
                    payload: JSON.stringify({
                        button: 'act1',
                    }),
                },
                color: 'positive',
            }),
        ], { columns: 1 }).oneTime());
})

bot.startPolling();
