const express = require('express');
const bodyParser = require('body-parser');
const loadJsonFile = require('load-json-file');
const jsdom = require("jsdom");
const iconv = require('iconv-lite');
const fs = require('fs');
const easyvk = require('easyvk');
const Readable = require('stream').Readable;
const nodemailer = require('nodemailer');
const LosslessJSON = require('lossless-json');
const fsPromises = require("fs/promises");

const VkBot = require('node-vk-bot-api');
const Markup = require('node-vk-bot-api/lib/markup');
const Session = require('node-vk-bot-api/lib/session');
const Scene = require('node-vk-bot-api/lib/scene');
const Stage = require('node-vk-bot-api/lib/stage');
const { response } = require('express');

let input_file = loadJsonFile.sync('./input_params.json');

let token = input_file[0].token;
let sender = input_file[0].sender;
let password = input_file[0].password
let getter = input_file[0].getter
let service = input_file[0].service
const fileContents = fs.readFileSync(input_file[0].vacancies, 'utf8')
let obj = LosslessJSON.parse(fileContents);
let MANAGER_ID = Number(input_file[0].manager_id);
console.log("Входные данные загружены");

setInterval(function () {
    console.log("Входные данные были обновлены");
    token = input_file[0].token;
    sender = input_file[0].sender;
    password = input_file[0].password;
    getter = input_file[0].getter;
    service = input_file[0].service;
    obj = loadJsonFile.sync(input_file[0].vacancies);
    MANAGER_ID = Number(input_file[0].manager_id);
}, 300000);

const api_key = token
const bot = new VkBot(api_key);

let CHOOSEN_ID = 0;
let CHOOSEN_NAME = "";

async function start() {
    try {
        await bot.startPolling((error) => {
            if (error) {
                console.error(error);
            } else {
                console.log("Bot started.");
            }
        });
    } catch (error) {
        console.log(error);
    }
}

const scene = new Scene('deal',
    (ctx) => {
        ctx.scene.next();
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
                Markup.button({
                    action: {
                        type: 'text',
                        label: 'Стоп',
                        payload: JSON.stringify({
                            button: 'act2',
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

        let filesArray = [];

        for (let i = 0; i < obj.length; i++) {
            flag = true;
            for (let j = 0; j < obj[i].id.toString().length; j++) {
                if (ctx.session.choosen_id.toString()[j] !== obj[i].id.toString()[j]) {
                    flag = false;
                }
            }
            if (flag) {
                for (let j = 0; j < obj[i].files.length; j++) {
                    if (obj[i].files[j].file_name.split(".")[1] != "html") {
                        filesArray.push(obj[i].files[j]);
                    }
                }
            }
        }

        if (filesArray.length == 0) {
            ctx.reply('Тестовое задание скоро пришлём :)', null, Markup
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
                    Markup.button({
                        action: {
                            type: 'text',
                            label: 'Стоп',
                            payload: JSON.stringify({
                                button: 'act2',
                            }),
                        },
                        color: 'negative',
                    }),
                ], { columns: 1 }).oneTime());

            easyvk({
                token: api_key,
                utils: {
                    longpoll: true
                }
            }).then(async vk => {

                const lpSettings = {
                    forGetLongPollServer: {
                        lp_version: 3,
                        need_pts: 1
                    },
                    forLongPollServer: {
                        wait: 15
                    }
                }

                await vk.call("messages.send", {
                    user_id: MANAGER_ID,
                    random_id: easyvk.randomId(),
                    peer_id: MANAGER_ID,
                    message: "Пользователь https://vk.com/id" + ctx.session.from_id + " оставил заявку по вакансии '" + ctx.session.choosen_name
                        + "'. Информация:\nФИО: " + ctx.session.fullname + "\nE-mail: " + ctx.session.email + "\nТелефон: " + ctx.session.number.toString() + "\nСопроводительная информация: "
                        + ctx.session.description + "\nВ выгрузке не оказалось тестового задания. Пожалуйста, свяжитесь с пользователем."
                })

                let transporter = nodemailer.createTransport({
                    service: service,
                    auth: {
                        user: sender,
                        pass: password,
                    },
                })

                await transporter.sendMail({
                    from: '"Чат-бот "Вакансии" <' + sender + ">",
                    to: getter,
                    subject: 'Заявка по вакансии "' + ctx.session.choosen_name + '"',
                    text: "Пользователь https://vk.com/id" + ctx.session.from_id + " оставил заявку по вакансии '" + ctx.session.choosen_name
                        + "'. Информация:\nФИО: " + ctx.session.fullname + "\nE-mail: " + ctx.session.email + "\nТелефон: " + ctx.session.number.toString() + "\nСопроводительная информация: "
                        + ctx.session.description + "\nНо в выгрузке не оказалось файла для тестового задания.",
                    html:
                        '<div>Пользователь <strong>https://vk.com/id' + ctx.session.from_id + ' </strong>оставил заявку по вакансии <i>' + ctx.session.choosen_name + '</i>. Информация:</div></br>' +
                        '<div> <strong>ФИО: </strong>' + ctx.session.fullname + '</div></br>' +
                        '<div> <strong>E-mail: </strong>' + ctx.session.email + '</div></br>' +
                        '<div> <strong>Номер телефона: </strong>' + ctx.session.number.toString() + '</div></br>' +
                        '<div> <strong>Сопроводительная информация: </strong>' + ctx.session.description + '</div></br>' +
                        '<div>В выгрузке не оказалось тестового задания. Пожалуйста, свяжитесь с пользователем.</strong> </div>'
                })
                console.log("Отправлено письмо на почту, пользователь указал свои данные для обратной связи. В выгрузке нет тестового задания.");
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
                    Markup.button({
                        action: {
                            type: 'text',
                            label: 'Стоп',
                            payload: JSON.stringify({
                                button: 'act2',
                            }),
                        },
                        color: 'negative',
                    }),
                ], { columns: 1 }).oneTime(true));
            ctx.scene.leave();
        } else {
            ctx.reply('Окей, держи тестовое задание. Его нужно сделать за 5 рабочий дней. Дерзай! Буду ждать!');
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

                    await server.upload({
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
                        await saveDoc(ctx.session.from_id, easyvk.randomId(), ctx.session.from_id, "Тестовое задание на позицию '" + ctx.session.choosen_name + "'", "doc" + res.doc.url.split("doc")[1].split('?')[0].toString()).then(response => {
                            fs.unlink(filesArray[k].file_name, (err) => {
                                if (err) {
                                    console.error(err)
                                    return
                                }
                            })
                        }).then(() => {
                            const index = filesArray.indexOf(k);
                            if (index > -1) {
                                filesArray.splice(index, 1);
                            }
                        })
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

                await vk.call("messages.send", {
                    user_id: MANAGER_ID,
                    random_id: easyvk.randomId(),
                    peer_id: MANAGER_ID,
                    message: "Пользователь https://vk.com/id" + ctx.session.from_id + " оставил заявку по вакансии '" + ctx.session.choosen_name
                        + "'. Информация:\nФИО: " + ctx.session.fullname + "\nE-mail: " + ctx.session.email + "\nТелефон: " + ctx.session.number.toString() + "\nСопроводительная информация: "
                        + ctx.session.description + "\nПользователю было выслано тестовое задание."
                })

                let transporter = nodemailer.createTransport({
                    service: service,
                    auth: {
                        user: sender,
                        pass: password,
                    },
                })

                await transporter.sendMail({
                    from: '"Чат-бот "Вакансии" <' + sender + ">",
                    to: getter,
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
                console.log("Отправлено письмо на почту, пользователь указал свои данные для обратной связи.");
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
                    Markup.button({
                        action: {
                            type: 'text',
                            label: 'Стоп',
                            payload: JSON.stringify({
                                button: 'act2',
                            }),
                        },
                        color: 'negative',
                    }),
                ], { columns: 1 }).oneTime());
            ctx.scene.leave();
        }
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
            Markup.button({
                action: {
                    type: 'text',
                    label: 'Стоп',
                    payload: JSON.stringify({
                        button: 'act2',
                    }),
                },
                color: 'negative',
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

                vk.longpoll.connect(lpSettings).then((lpcon) => {
                    let flag = true;
                    lpcon.on("message", async (msg) => {
                        let fullMessage = await getMessage(msg);
                        fullMessage = fullMessage.items[0]
                        while (flag) {
                            flag = false
                            await sendMessageToManager(MANAGER_ID, easyvk.randomId(), MANAGER_ID, "Пользователь https://vk.com/id" + fullMessage.peer_id.toString() + " хочет пообщаться с менеджером по поводу вакансий.")
                        }
                    })
                })
            })

            let transporter = nodemailer.createTransport({
                service: service,
                auth: {
                    user: sender,
                    pass: password,
                },
            })

            await transporter.sendMail({
                from: '"Чат-бот "Вакансии" <' + sender + '>',
                to: getter,
                subject: 'Заявка от пользователя',
                text: "Пользователь https://vk.com/id" + ctx.message.from_id.toString() + " хочет поговорить с менеджером.",
                html:
                    '<div>Пользователь <strong>https://vk.com/id' + ctx.message.from_id.toString() + ' </strong> хочет поговорить с менеджером.</div>'
            })
            console.log("Отправлено письмо на почту, пользователь хочет поговорить с менеджером.");

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
                    Markup.button({
                        action: {
                            type: 'text',
                            label: 'Стоп',
                            payload: JSON.stringify({
                                button: 'act2',
                            }),
                        },
                        color: 'negative',
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

    fullarr = [];

    varArr = [];

    let varArr_reserved = [];

    let fullArr_reserved = [];

    for (let i = 0; i < obj.length; i++) {
        if (obj[i].is_reserve === true) {
            console.log(obj[i].id.toString())
            fullArr_reserved.push({
                id: obj[i].id.toString(),
                name: obj[i].name,
                is_reserve: obj[i].is_reserve,
                files: obj[i].files ? obj[i].files : null
            })

            varArr_reserved.push(
                Markup.button({
                    action: {
                        type: 'text', // Тип кнопки
                        label: obj[i].name, // Текст
                        payload: JSON.stringify({
                            button: 'act9',
                        }),
                    },
                    color: 'primary', // цвет текста
                })
            )
        }
    }

    varArr_reserved.push(
        Markup.button({
            action: {
                type: 'text', // Тип кнопки
                label: 'В начало', // Текст
                payload: JSON.stringify({
                    button: 'wer', // Полезная нагрузка на кнопку при нажатии её, вк будет передавать этот текст
                }),
            },
            color: 'positive', // цвет текста
        }),
        Markup.button({
            action: {
                type: 'text',
                label: 'Стоп',
                payload: JSON.stringify({
                    button: 'act2',
                }),
            },
            color: 'negative',
        }),
    )

    for (let i = 0; i < fullArr_reserved.length; i++) {

        bot.command(fullArr_reserved[i].name, async ctx => {
            try {
                let IF_HTML = false;
                let HTML_POS = 0;
                for (let q = 0; q < fullArr_reserved[i].files.length; q++) {
                    if (fullArr_reserved[i].files[q].file_name.split(".")[1] == 'html') {
                        IF_HTML = true;
                        HTML_POS = q;
                    }
                }

                if (IF_HTML) {
                    let buff = Buffer.from(fullArr_reserved[i].files[HTML_POS].content.toString(), 'base64');

                    var output = iconv.decode(buff, "windows-1251").toString();

                    var span = new jsdom.JSDOM().window.document.createElement('span');

                    span.innerHTML = output;

                    span.innerHTML = span.innerHTML.replace(/\n{2,}/g, "\n\n");

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

                    ctx.session.choosen_id = fullArr_reserved[i].id;
                    ctx.session.choosen_name = fullArr_reserved[i].name;

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
                            Markup.button({
                                action: {
                                    type: 'text',
                                    label: 'Стоп',
                                    payload: JSON.stringify({
                                        button: 'act2',
                                    }),
                                },
                                color: 'negative',
                            }),
                        ], { columns: 1 }).oneTime());
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
                            Markup.button({
                                action: {
                                    type: 'text',
                                    label: 'Стоп',
                                    payload: JSON.stringify({
                                        button: 'act2',
                                    }),
                                },
                                color: 'negative',
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
            .keyboard(varArr_reserved, { columns: 2 }).oneTime(true));
    } catch (e) {
        console.error(e);
    }
})

bot.command(['Хочу посмотреть открытые вакансии!', 'Назад к открытым вакансиям'], async (ctx) => {

    let varArr = [];

    let fullArr = [];

    for (let i = 0; i < obj.length; i++) {

        if (obj[i].is_reserve === false) {
            console.log(obj[i].id.toString())
            fullArr.push({
                id: obj[i].id.toString(),
                name: obj[i].name,
                is_reserve: obj[i].is_reserve,
                files: obj[i].files ? obj[i].files : null
            })
            varArr.push(
                Markup.button({
                    action: {
                        type: 'text', // Тип кнопки
                        label: obj[i].name + ".", // Текст
                        payload: JSON.stringify({
                            button: 'act3',
                        }),
                    },
                    color: 'primary', // цвет текста
                })
            )
        }
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
        }),
        Markup.button({
            action: {
                type: 'text',
                label: 'Стоп',
                payload: JSON.stringify({
                    button: 'act2',
                }),
            },
            color: 'negative',
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
        bot.command(fullArr[i].name.toString() + ".", async ctx => {
            try {

                let IF_HTML = false;
                let HTML_POS = 0;

                for (let q = 0; q < fullArr[i].files.length; q++) {
                    if (fullArr[i].files[q].file_name.split(".")[1] == 'html') {
                        IF_HTML = true;
                        HTML_POS = q;
                    }
                }

                if (IF_HTML) {
                    let buff = Buffer.from(fullArr[i].files[HTML_POS].content.toString(), 'base64');

                    var output = iconv.decode(buff, "windows-1251").toString();

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
                            Markup.button({
                                action: {
                                    type: 'text',
                                    label: 'Стоп',
                                    payload: JSON.stringify({
                                        button: 'act2',
                                    }),
                                },
                                color: 'negative',
                            }),
                        ], { columns: 1 }).oneTime());
                }
                else {
                    await ctx.reply('Описания пока нет :( Оно скоро появится.', null, Markup
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
                            Markup.button({
                                action: {
                                    type: 'text',
                                    label: 'Стоп',
                                    payload: JSON.stringify({
                                        button: 'act2',
                                    }),
                                },
                                color: 'negative',
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
            .keyboard(varArr, { columns: 2 }).oneTime(true));

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

            await vk.call("messages.send", {
                user_id: MANAGER_ID,
                random_id: easyvk.randomId(),
                peer_id: MANAGER_ID,
                message: "Пользователь https://vk.com/id" + ctx.session.from_id + " оставил заявку по вакансии '" + ctx.session.choosen_name
                    + "'. Информация:\nФИО: " + ctx.session.fullname + "\nE-mail: " + ctx.session.email + "\nТелефон: " + ctx.session.number.toString() + "\nСопроводительная информация: "
                    + ctx.session.description + "\nПользователь отказался от получения тестового задания."
            })

            let transporter = nodemailer.createTransport({
                service: service,
                auth: {
                    user: sender,
                    pass: password,
                },
            })

            await transporter.sendMail({
                from: '"Чат-бот "Вакансии" <' + sender + ">",
                to: getter,
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
            console.log("Отправлено письмо на почту, пользователь указал свои данные для обратной связи.");
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
                Markup.button({
                    action: {
                        type: 'text',
                        label: 'Стоп',
                        payload: JSON.stringify({
                            button: 'act2',
                        }),
                    },
                    color: 'negative',
                }),
            ], { columns: 1 }).oneTime());
    } catch (e) {
        console.error(e);
    }
})

bot.command(['/stop', 'Stop', 'stop', 'Стоп', 'стоп'], async (ctx) => {
    await ctx.reply('До скорого! Если хочешь снова пообщаться с ботом, напиши "Начать". Если хочешь пообщаться с менеджером, просто напиши свой вопрос, менеджер обязательно ответит тебе в рабочее время.')
})

start()