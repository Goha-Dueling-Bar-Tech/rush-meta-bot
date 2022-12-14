const {
    SlashCommandBuilder
} = require('discord.js');
var { AsciiTable3, AlignmentEnum } = require('ascii-table3');


const AWS = require('aws-sdk');
// Set the region 
AWS.config.update({region: process.env.AWS_REGION });

// Create the DynamoDB service object
var ddb = new AWS.DynamoDB({apiVersion: '2012-08-10'});
var docClient = new AWS.DynamoDB.DocumentClient()

module.exports = {
    data: new SlashCommandBuilder()
        .setName('weekly-report')
        .setDescription('Generates meta report for the past week')
        .addStringOption(option =>
            option.setName('report_type')
            .setDescription('Type of report for desired outout')
			.addChoices(
				{ name: 'decks', value: 'decks' },
				{ name: 'legends' , value: 'legends' },
				{ name: 'both', value: 'both' }
			)
            .setRequired(true)),
    async execute(interaction) {
		let channel = interaction.member.guild.channels.cache.find(c => c.id === interaction.channelId)

		const reportType = interaction.options.getString('report_type') 

		const startDate = new Date(Date.now())
		startDate.setDate(startDate.getDate() - 6)
		const endDate = new Date(Date.now())

		var params = {
			TableName: 'rush-meta',
		};

		docClient.scan(params, async function(err, data) {
			if (err) {
				console.error("Unable to read item. Error JSON:", JSON.stringify(err, null, 2));
			} else {
				let legends = {}
				let decks = {}

				const filtered = data.Items.filter(obj => {
					const created_at = new Date(obj.CREATED_AT)
					return created_at <= endDate && created_at >= startDate
				})
				
				for (let entry of filtered) {
					if (entry.FIRST_LEGEND !== 'undefined') {
						if (legends[entry.FIRST_LEGEND]) {
							legends[entry.FIRST_LEGEND] = legends[entry.FIRST_LEGEND] + 1
						} else {
							legends[entry.FIRST_LEGEND] = 1
						}
					}

					if (entry.SECOND_LEGEND !== 'undefined') {
						if (legends[entry.SECOND_LEGEND]) {
							legends[entry.SECOND_LEGEND] = legends[entry.SECOND_LEGEND] + 1
						} else {
							legends[entry.SECOND_LEGEND] = 1
						}
					}

					if (entry.THIRD_LEGEND !== 'undefined') {
						if (legends[entry.THIRD_LEGEND]) {
							legends[entry.THIRD_LEGEND] = legends[entry.THIRD_LEGEND] + 1
						} else {
							legends[entry.THIRD_LEGEND] = 1
						}
					}

					if (entry.DECK_TYPE !== 'undefined') {
						if (decks[entry.DECK_TYPE]) {
							decks[entry.DECK_TYPE] = decks[entry.DECK_TYPE] + 1
						} else {
							decks[entry.DECK_TYPE] = 1
						}
					}

					if (entry.FIRST_LEGEND === 'undefined' && entry.SECOND_LEGEND === 'undefined' && entry.THIRD_LEGEND === 'undefined') {
						if (legends["None"]) {
							legends["None"] = legends["None"] + 1
						} else {
							legends["None"] = 1
						}
					}
				}


				decks = Object.entries(decks).sort((a,b) => b[1] - a[1])
				legends = Object.entries(legends).sort((a,b) => b[1] - a[1])

				const totalDecks = decks.reduce((val1, val2) => val1 + val2[1], 0)
				const totalLegends = legends.reduce((val1, val2) => val1 + val2[1], 0)


				let longestString = ''
				for (let entry of decks) {
					if (entry[0].length > longestString.length) {
						longestString = entry[0]
					}
				}


				for (let entry of legends) {
					if (entry[0].length > longestString.length) {
						longestString = entry[0]
					}
				}


				for (let entry of decks) {
					while (entry[0].length < longestString.length) {
						entry[0] = entry[0] + '  '
					}
				}


				for (let entry of legends) {
					while (entry[0].length < longestString.length) {
						entry[0] = entry[0] + '  '
					}
				}


				let headings = []
				if (reportType === 'both') {
					headings = [`**Decks (${(totalDecks)} Total)**`, '**Amount**', `**Legends (${totalLegends} Total)**`, '**Amount**']
				}

				if (reportType === 'legends') {
					headings = [`**Legends (${totalLegends} Total)**`, '**Amount**']
				}

				if (reportType === 'decks') {
					headings = [`**Decks (${(totalDecks)} Total)**`, '**Amount**']
				}

				for (let idx in headings) {
					while (headings[idx].length - 4 < longestString.length) {
						headings[idx] = ' ' + headings[idx] + '  '
					}
				}


				const table = new AsciiTable3(`*Rush Duel Meta for Week: ${startDate.toDateString()} -> ${endDate.toDateString()}*`)
				
				while (decks.length < legends.length) {
					decks = [...decks, [new Array(longestString.length).join(' '), '']]
				}

				while (legends.length < decks.length && reportType === 'both') {
					legends = [...legends, [new Array(longestString.length).join(' '), '']]
				}

				if (reportType === 'both') {
					table
					.setHeading(...headings)
					.setAlign(1, AlignmentEnum.LEFT)
					.setAlign(2, AlignmentEnum.CENTER)
					.setAlign(3, AlignmentEnum.LEFT)
					.setAlign(4, AlignmentEnum.CENTER)
					.addRowMatrix([
						...decks.map((o, idx) => [
							o[0], 
							`${o[1]} (${((o[1] / totalDecks) * 100).toFixed(2)}%)`,
							legends[idx][0],
							`${legends[idx][1]} (${((legends[idx][1] / totalLegends) * 100).toFixed(2)}%)`
						])
					]);
				} else if (reportType === 'decks') {
					table
					.setHeading(...headings)
					.setAlign(1, AlignmentEnum.LEFT)
					.setAlign(2, AlignmentEnum.CENTER)
					.addRowMatrix([
						...decks.map((o, idx) => [
							o[0], 
							`${o[1]} (${((o[1] / totalDecks) * 100).toFixed(2)}%)`
						])
					]);
				} else {
					table
					.setHeading(...headings)
					.setAlign(1, AlignmentEnum.LEFT)
					.setAlign(2, AlignmentEnum.CENTER)
					.addRowMatrix([
						...legends.map((o, idx) => [
							o[0], 
							`${o[1]} (${((o[1] / totalLegends) * 100).toFixed(2)}%)`
						])
					]);
				}
				
				const tableString = table.toString()
				
				for (line of tableString.split('\n')) {
					line && line !== '' && await channel.send(line)
				}
			}
		})

        interaction.reply('Curated by Voltalon#3223 & AigamiN7#8269')
    },
};