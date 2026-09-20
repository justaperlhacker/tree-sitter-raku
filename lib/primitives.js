module.exports = {
  primitive: $ => choice(
    $.number,
    $.boolean
  ),
  number: $ => {
    const hexLiteral = seq(
      choice('0x', '0X'),
      /[\da-fA-F](_?[\da-fA-F])*/
    )

    const decimalDigits = /\d(_?\d)*/
    const exponentPart = seq(choice('e', 'E'), optional(choice('-', '+')), decimalDigits)

    const binaryLiteral = seq(choice('0b', '0B'), /[0-1](_?[0-1])*/)

    const octalLiteral = choice(
      seq('0', /[0-7](_?[0-7])*/),
      seq(choice('0o', '0O'), /[0-7](_?[0-7])*/)
    )

    const decimalIntegerLiteral = choice(
      '0',
      seq(/[1-9]/, optional(seq(optional('_'), decimalDigits)))
    )

    const decimalLiteral = choice(
      // 111.555e99 (Raku requires digits after the dot, unlike Perl's `1.`)
      seq(decimalIntegerLiteral, '.', decimalDigits, optional(exponentPart)),
      // .555e99
      seq('.', decimalDigits, optional(exponentPart)),
      // 111e99
      seq(decimalIntegerLiteral, exponentPart),
      // 111
      decimalDigits,
      // 0d111
      seq(choice('0d', '0D'), decimalDigits)
    )

    return token(choice(
      decimalLiteral,
      hexLiteral,
      binaryLiteral,
      octalLiteral
    ))
  },
  boolean: $ => choice('true', 'false')
}
