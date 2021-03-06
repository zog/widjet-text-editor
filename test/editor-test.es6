import expect from 'expect.js'
import jsdom from 'mocha-jsdom'
import sinon from 'sinon'
import widgets from 'widjet'

import {click, keydown} from 'widjet-test-utils/events'
import {waitsFor} from 'widjet-test-utils/async'
import {setPageContent, getTestRoot} from 'widjet-test-utils/dom'

import {Markdown} from '../src/index'

describe('text-editor', () => {
  jsdom()

  let textarea

  beforeEach(() => {
    setPageContent(`
      <div class='text-editor'>
        <button data-wrap='**|**'
                data-keystroke='ctrl-b'></button>

        <button data-wrap='[|]($url "$title")'
                data-keystroke='ctrl-u'></button>

        <button data-wrap='\\||\\|'
                data-keystroke='ctrl-r'></button>

        <button data-wrap='codeBlock'></button>
        <button data-wrap='blockquote'></button>

        <button data-wrap='unorderedList'
                data-keystroke='ctrl-u'
                data-next-line-repeater='- '></button>

        <button data-wrap='orderedList'
                data-keystroke='ctrl-o'
                data-next-line-repeater='repeatOrderedList'></button>

        <textarea></textarea>
      </div>
    `)

    textarea = getTestRoot().querySelector('textarea')
    textarea.selectionStart = textarea.selectionEnd = 0

    widgets('text-editor', '.text-editor', {
      on: 'init',
      repeatOrderedList: Markdown.repeatOrderedList,
      unorderedList: Markdown.unorderedList,
      orderedList: Markdown.orderedList,
      codeBlock: Markdown.codeBlock,
      blockquote: Markdown.blockquote
    })
  })

  describe('clicking on an action button', () => {
    beforeEach(() => {
      const button = getTestRoot().querySelector('[data-wrap="**|**"]')
      click(button)
    })

    it('inserts the corresponding text', () => {
      expect(textarea.value).to.eql('****')
    })

    it('places the cursor at the position of the | in the data-wrap value', () => {
      expect(textarea.selectionEnd).to.eql(2)
      expect(textarea.selectionStart).to.eql(2)
    })

    describe('that have a drap-wrap attribute that refer to a function in the options', () => {
      beforeEach(() => {
        textarea.value = 'some text content\nsome text content\nsome text content'
        textarea.selectionStart = 5
        textarea.selectionEnd = 27

        const button = getTestRoot().querySelector('[data-wrap="codeBlock"]')
        click(button)
      })

      it('inserts the corresponding text', () => {
        expect(textarea.value).to.eql('    some text content\n    some text content\nsome text content')
      })
    })
  })

  describe('when there is no controls with Keystrokes', () => {
    beforeEach(() => {
      setPageContent(`
      <div class='text-editor'>
        <textarea></textarea>
      </div>
      `)

      textarea = getTestRoot().querySelector('textarea')
      sinon.stub(textarea, 'addEventListener')

      widgets('text-editor', '.text-editor', {on: 'init'})
    })

    it('does not register a listener for the textarea keydown event', () => {
      expect(textarea.addEventListener.calledWith('keydown')).not.to.be.ok()
    })
  })

  describe('when the text editor has the focus', () => {
    beforeEach(() => { textarea.focus() })

    describe('using a key stroke', () => {
      describe('when the textarea selection start and end are intricated', () => {
        beforeEach(() => {
          keydown(textarea, {ctrlKey: true, key: 'b'})
        })

        it('inserts the corresponding text', () => {
          expect(textarea.value).to.eql('****')
        })

        it('places the cursor at the position of the | in the data-wrap value', () => {
          expect(textarea.selectionEnd).to.eql(2)
          expect(textarea.selectionStart).to.eql(2)
        })
      })

      describe('when the textarea selection spans several characters', () => {
        beforeEach(() => {
          textarea.value = 'some text content'
          textarea.selectionStart = 5
          textarea.selectionEnd = 9

          keydown(textarea, {ctrlKey: true, keyCode: 98})
        })

        it('wraps the selected text with the data-wrap value', () => {
          expect(textarea.value).to.eql('some **text** content')
        })

        it('moves the selection to follow the wrapped content', () => {
          expect(textarea.selectionStart).to.eql(7)
          expect(textarea.selectionEnd).to.eql(11)
        })
      })

      describe('when the wrap pattern contains a token', () => {
        beforeEach(() => {
          sinon.stub(window, 'prompt').returns('foo')

          textarea.value = 'some text content'
          textarea.selectionStart = 5
          textarea.selectionEnd = 9

          keydown(textarea, {ctrlKey: true, key: 'u'})

          return waitsFor('user prompted', () => window.prompt.called)
        })

        it('prompts the user for input and uses the provided value', () => {
          expect(textarea.value).to.eql('some [text](foo "foo") content')
        })
      })

      describe('when the wrap pattern contains an escaped pipe', () => {
        beforeEach(() => {
          textarea.value = 'some text content'
          textarea.selectionStart = 5
          textarea.selectionEnd = 9

          keydown(textarea, {ctrlKey: true, key: 'r'})
        })

        it('inserts pipes properly', () => {
          expect(textarea.value).to.eql('some |text| content')
        })
      })
    })

    describe('pressing enter', () => {
      describe('on a line that matches a repeater pattern', () => {
        describe('that has no custom repeater function', () => {
          beforeEach(() => {
            textarea.value = '- some text content'
            textarea.selectionStart = textarea.value.length

            keydown(textarea, {keyCode: 13})
          })

          it('reproduces the pattern on the next line', () => {
            expect(textarea.value).to.eql('- some text content\n- ')
          })
        })

        describe('that has a repeater function', () => {
          beforeEach(() => {
            textarea.value = '1. some text content'
            textarea.selectionStart = textarea.value.length

            keydown(textarea, {keyCode: 13})
          })

          it('calls the repeater function', () => {
            expect(textarea.value).to.eql('1. some text content\n2. ')
          })
        })
      })

      describe('on a normal line', () => {
        beforeEach(() => {
          textarea.value = '\nsome text content'
          textarea.selectionStart = textarea.value.length

          keydown(textarea, {keyCode: 13})
        })

        it('does not insert anything', () => {
          expect(textarea.value).to.eql('\nsome text content')
        })
      })
    })
  })

  describe('markdown helpers', () => {
    describe('blockquote', () => {
      beforeEach(() => {
        textarea.value = 'some text content\nsome text content\nsome text content'
        textarea.selectionStart = 5
        textarea.selectionEnd = 27

        const button = getTestRoot().querySelector('[data-wrap="blockquote"]')
        click(button)
      })

      it('inserts a > on each of the selection', () => {
        expect(textarea.value).to.eql('> some text content\n> some text content\nsome text content')
      })
    })

    describe('unorderedList', () => {
      beforeEach(() => {
        textarea.value = 'some text content\nsome text content\nsome text content'
        textarea.selectionStart = 5
        textarea.selectionEnd = 27

        const button = getTestRoot().querySelector('[data-wrap="unorderedList"]')
        click(button)
      })

      it('inserts a - on the first line of the selection', () => {
        expect(textarea.value).to.eql('- some text content\n  some text content\nsome text content')
      })
    })

    describe('orderedList', () => {
      beforeEach(() => {
        textarea.value = 'some text content\nsome text content\nsome text content'
        textarea.selectionStart = 5
        textarea.selectionEnd = 27

        const button = getTestRoot().querySelector('[data-wrap="orderedList"]')
        click(button)
      })

      it('inserts a 1. on the first line of the selection', () => {
        expect(textarea.value).to.eql('1. some text content\n  some text content\nsome text content')
      })
    })
  })
})
