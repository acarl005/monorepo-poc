import chalk from 'chalk'
const { version } = require('../package.json')

module.exports = () => {
  console.log(chalk.cyan(`version ${version} of "a" says EY DUDE`))
}
