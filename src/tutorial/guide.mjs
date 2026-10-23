import { html, render } from 'lit-html'
import examples from './examples.json'
import highlighted from 'virtual:tutorial-highlighting'

const checkpoints = import.meta.glob('../../docs/tutorial/*/*', {
  query: '?raw', import: 'default', eager: true,
})

const chapters = [
  ['get-ready', '00', 'Get ready'],
  ['first-view', '01', 'Put state on screen'],
  ['editing', '02', 'Make it editable'],
  ['themes', '03', 'Add colour choices'],
  ['saving', '04', 'Save with an effect'],
  ['restoring', '05', 'Restore a design'],
  ['subscriptions', '06', 'Listen for shortcuts'],
  ['keep-going', '↗', 'Make it your own'],
]

function code(source) {
  const text = source.trim()
  const entry = highlighted[text]
  if (!entry) return html`<pre><code>${text}</code></pre>`
  return html`<pre data-language=${entry.language}><code>${entry.lines.map((line, index) => html`${index ? '\n' : ''}${line.map(token => html`<span style=${`color: ${token.color}`}>${token.content}</span>`)}`)}</code></pre>`
}
const exercise = content => html`<aside class="try-it"><p><strong>Try it.</strong> ${content}</p></aside>`

function files(folder) {
  const sources = Object.entries(checkpoints)
    .filter(([path]) => path.includes(`/${folder}/`))
    .sort(([a], [b]) => {
      const rank = path => path.endsWith('.gleam') ? 0 : path.endsWith('/view.mjs') ? 1 : 2
      return rank(a) - rank(b) || a.localeCompare(b)
    })
  return html`
    <h3>Complete checkpoint</h3>
    <p>Replace the files below in <code>src/tutorial/</code> with these complete versions. You can also copy this checkpoint from your checkout:</p>
    ${code(`cp docs/tutorial/${folder}/* src/tutorial/`)}
    ${sources.map(([path, source]) => {
      const name = path.split('/').at(-1)
      return html`<details class="source-details">
        <summary>src/tutorial/${name}</summary>
        <div class="source-toolbar"><span>${name.endsWith('.gleam') ? 'Gleam' : 'JavaScript'}</span>
          <button type="button" aria-label=${`Copy ${folder}/${name}`} @click=${event => copy(source, event)}>Copy file</button>
          <a href=${`data:text/plain;charset=utf-8,${encodeURIComponent(source)}`} download=${name}>Download</a>
        </div>
        ${code(source)}
      </details>`
    })}
  `
}

async function copy(source, event) {
  const button = event.currentTarget
  const status = document.getElementById('copy-status')
  try {
    await navigator.clipboard.writeText(source)
    button.textContent = 'Copied'
    status.textContent = 'File copied. Paste it into the matching file in src/tutorial/.'
    setTimeout(() => { button.textContent = 'Copy file' }, 2000)
  } catch {
    status.textContent = 'Clipboard access is unavailable. Select the code to copy it, or use Download.'
  }
}

export function mountGuide() {
  render(html`
    <div class="learning-layout" id="lessons">
      <nav class="lesson-nav" aria-label="Tutorial chapters">
        <p class="eyebrow">Build, then understand</p>
        ${chapters.map(([id, number, title]) => html`<a href=${`#${id}`}><span>${number}</span>${title}</a>`)}
      </nav>
      <div>
        <p class="copy-status" id="copy-status" role="status"></p>
        <section class="lesson" id="get-ready" aria-labelledby="ready-title">
          <p class="eyebrow">00 / Set up your workbench</p>
          <h2 id="ready-title">Get it running locally</h2>
          <p>You’ll build Postcard Studio: an editor for a short message and a colour theme. Your text appears on a postcard as you type. Later, you’ll save it in the browser and add a keyboard shortcut.</p>
          <p>This is a hands-on Glimlit guide, rather than an official Gleam tutorial. We’ll explain the language concepts we use as we go. Gleam is a small language that’s easy to pick up, so learning enough to get started doesn’t need a large investment of time. For a fuller introduction and reference, visit <a href="https://gleam.run/documentation/" target="_blank" rel="noopener noreferrer">Gleam’s official documentation ↗<span class="sr-only"> (opens in a new tab)</span></a>.</p>
          <p>Install <a href="https://gleam.run/getting-started/installing/">Gleam</a>, and <a href="https://nodejs.org/en/download">Node.js</a> 20.19+ or 22.12+ with npm. Gleam is a programming language that compiles to JavaScript here. Vite runs the development server and rebuilds your app when files change.</p>
          <ol>
            <li><a href="https://github.com/bmehder/glimlit">Clone the repository or download its ZIP</a> using GitHub’s Code menu. Extract the ZIP if you download it.</li>
            <li>Open the project folder in your editor, and open a terminal in that folder. It contains <code>package.json</code> and <code>gleam.toml</code>.</li>
            <li>Run the commands below. Leave the development server running, and open <a href="http://127.0.0.1:3000/tutorial/">http://127.0.0.1:3000/tutorial/</a>. Use the address Vite prints if port 3000 is already in use.</li>
          </ol>
          ${code(examples.setup.source)}
          <p>The repository includes the finished app. To build it gradually, start by applying checkpoint 01. Every chapter provides complete files, so you can type along, copy them, or compare them with your own version. The preview at the top of your local tutorial page runs the files you’re editing.</p>
          <p>Keep <code>npm run dev</code> running. Use a second terminal in the same project folder for the checkpoint copy commands. Files left from later chapters are unused until you reach those chapters.</p>
          <h3>The files you’ll work in</h3>
          ${code(examples.files.source)}
          <p>The page, styles, and build setup are already connected. <code>tutorial/index.html</code> calls your app’s <code>main()</code> function. It provides a <code>tutorial-app</code> element for your view. You don’t need to change the counter or todo app, or write a new build configuration.</p>
          <h3>Three ideas we’ll use</h3>
          <ul>
            <li><strong>Model:</strong> the current state of the app, such as the postcard title.</li>
            <li><strong>View:</strong> a function that shows the model and turns user actions into messages.</li>
            <li><strong>Update:</strong> a function that takes the current model and a message, and returns the next model.</li>
          </ul>
          <p>This is Model–View–Update, often shortened to MVU. Elm is a language and web framework that popularised this approach. You don’t need to know Elm to use it here.</p>
          ${exercise(html`Check that <code>gleam --version</code> and <code>node --version</code> work in your terminal. Then try the finished preview before replacing it with the first checkpoint.`)}
        </section>

        <section class="lesson" id="first-view" aria-labelledby="first-title">
          <p class="eyebrow">01 / Model → View</p>
          <h2 id="first-title">Put state on screen</h2>
          <p>Start with a postcard that displays two strings. No editing, browser storage, or event listeners yet.</p>
          <h3>Give your state a shape</h3>
          ${code(examples.model.source)}
          <p><code>pub</code> makes a definition available outside its module. <code>type</code> defines the shape of a value. The inner <code>Model(...)</code> is a constructor: calling it creates a model with named fields. Think of this record as an immutable JavaScript object whose fields have checked types. <code>String</code> is Gleam’s text type.</p>
          <p><code>init()</code> creates the starting model. <code>fn</code> defines a function, and its last expression is its return value. There’s no <code>return</code> keyword.</p>
          ${code(examples.init.source)}
          <p><code>#(a, b)</code> is a tuple: a fixed group of values. Our runtime expects a pair containing a model and a list of work to perform. <code>[]</code> is an empty list. For the first three chapters, leave that list empty. <code>-&gt;</code> introduces the return type. You can read <code>List(Effect(Msg))</code> as “a list of effects that can send messages.” We’ll use it in chapter 04.</p>
          <p>The first checkpoint has a single placeholder message, <code>NoOp</code>. Its update function returns the model unchanged. We only need it to complete the runtime’s interface before we introduce real messages.</p>
          <h3>Render it with lit-html</h3>
          ${code(examples.render.source)}
          <p><code>html</code> is a JavaScript tag function applied to a template literal, the expression inside backticks. <code>lit-html</code> turns that template into DOM nodes; <code>render</code> puts them in the mount element. Expressions inside <code>\u0024{...}</code> provide dynamic values. Text values render as text, so typing an HTML tag into a message will not execute it.</p>
          <p>The compiler generates <code>tutorial.mjs</code> from <code>tutorial.gleam</code>. We import <code>Model$Model$title</code> and give it the shorter JavaScript name <code>title</code>. It reads the title field from a model. You edit the Gleam source, not this generated module.</p>
          <h3>Connect the two languages</h3>
          ${code(examples.external.source)}
          <p><code>@external</code> tells Gleam that the implementation of <code>view</code> lives in JavaScript. Its declaration states the types Gleam expects. <code>dispatch</code> is a function that accepts a message. <code>Nil</code> means there is no useful return value, similar to JavaScript’s <code>undefined</code>. The function returned by <code>main</code> stops the app; the page already handles calling it when needed.</p>
          ${files('01-first-view')}
          ${exercise(html`Change the title in <code>init()</code>, save the file, and find the new title on your local preview. You have changed the model and seen the view follow it. Browser controls and saving should not appear at this checkpoint.`)}
        </section>

        <section class="lesson" id="editing" aria-labelledby="editing-title">
          <p class="eyebrow">02 / Complete the loop</p>
          <h2 id="editing-title">Make the postcard editable</h2>
          <p>Add a title input and a message textarea. Instead of changing state inside an event handler, describe what happened using a message.</p>
          ${code(examples.update.source)}
          <p>A custom type can have several variants. Here, each message holds the text the user typed. <code>case</code> matches the variant and gives its data a name. The compiler checks that you handle every possible message. <code>Model(..model, title: title)</code> creates a new model by copying the existing fields and replacing the title. The previous model stays unchanged.</p>
          <h3>Send a message from the input</h3>
          ${code(examples.input.source)}
          <p><code>@input</code> attaches a DOM event listener. The handler reads the input’s value, creates a Gleam message with its generated JavaScript constructor, and sends it with <code>dispatch</code>. The runtime calls <code>update</code>, stores the next model, and calls <code>view</code> again.</p>
          <p><code>.value</code> sets a JavaScript property on the DOM element, rather than its HTML attribute. <code>live</code>, imported from <code>lit-html/directives/live.js</code>, compares against the current DOM value. That helps keep user-edited controls in sync when the model changes, including when we add restore later.</p>
          <p>lit-html updates the changing parts of the template. You don’t need to find the preview heading and set its text manually. The model is the shared source for both the editor and the preview.</p>
          ${files('02-editing')}
          ${exercise(html`Type into both fields. The preview should update immediately, and typing in the title must preserve the message. Refresh the page: your edits disappear because they only live in the model so far.`)}
        </section>

        <section class="lesson" id="themes" aria-labelledby="themes-title">
          <p class="eyebrow">03 / More state, same loop</p>
          <h2 id="themes-title">Give it a little colour</h2>
          <p>Add three colour themes. A theme is another custom type, but its variants carry no extra data.</p>
          ${code(examples.themes.source)}
          <p>Add <code>theme: Theme</code> to the model, initialise it with <code>Coral</code>, and add <code>UserSelectedTheme(Theme)</code> to the message type. Its update branch creates a new model with the selected theme. Using a custom type means Gleam won’t accept an arbitrary string where a theme is expected.</p>
          <p>The view uses <code>theme_name</code> to pick the CSS class <code>postcard-coral</code>, <code>postcard-ocean</code>, or <code>postcard-meadow</code>. The theme buttons send messages just like the text inputs do. Their <code>aria-pressed</code> attributes communicate which choice is selected.</p>
          <p>The styles are already in <code>src/tutorial/tutorial.css</code>. The editor uses regular CSS for readability; the project’s Tailwind setup is available if you prefer utility classes.</p>
          ${files('03-themes')}
          ${exercise(html`Switch colours, then change the text. Both should persist while you interact. Trace one button click through its message, update branch, model field, and CSS class. This is a complete interactive app with no effects or subscriptions.`)}
        </section>

        <section class="lesson" id="saving" aria-labelledby="saving-title">
          <p class="eyebrow">04 / Work outside the model</p>
          <h2 id="saving-title">Save with an effect</h2>
          <p>A model is an in-memory value. Writing to browser storage changes something outside that value. That work is an <strong>effect</strong>.</p>
          <p>Keep <code>update</code> pure: for a given model and message, it returns the same next model and descriptions of work. It does not write to storage itself. Return an effect value instead of the empty list we have used so far.</p>
          ${code(examples.saveMessage.source)}
          <p>Add <code>notice: String</code> to the model for feedback, and messages for saving, success, and failure. Declare <code>save_design</code> as an external function implemented by <code>saveDesign</code> in <code>effects.mjs</code>.</p>
          ${code(examples.saveEffect.source)}
          <p>The full file defines <code>key</code> and imports the message constructors. Calling <code>saveDesign</code> only constructs an object. Later, the runtime calls <code>perform</code>. It first renders the next model, so feedback like “Saving…” can be shown before work begins.</p>
          <p><code>onSuccess</code> creates a <code>DesignSaved</code> message; <code>onFailure</code> creates <code>StorageFailed</code>. Each goes through <code>update</code> to change the notice. These constructors are imported with names such as <code>Msg$DesignSaved</code> and aliased for readability. The generated exports can differ between messages with and without data; use the imports shown in the complete file.</p>
          <p><code>localStorage</code> stores strings for this site in this browser. We use <code>JSON.stringify</code> to encode the design. It isn’t uploaded or shared across devices. Storage can be blocked, which is why the failure path matters.</p>
          ${files('04-saving')}
          ${exercise(html`Change the postcard and click Save design. Expect “Saved in this browser.” Refreshing still shows the defaults at this step: saving and restoring are separate operations. In your browser’s storage tools, look for the key <code>glimlit.postcard.v1</code>.`)}
        </section>

        <section class="lesson" id="restoring" aria-labelledby="restoring-title">
          <p class="eyebrow">05 / Results become messages</p>
          <h2 id="restoring-title">Bring a saved design back</h2>
          <p>Add a Restore saved button. Reading storage is another effect. It returns either a saved JSON string or no saved value.</p>
          ${code(examples.restoreEffect.source)}
          <p>The update function returns <code>[load_design()]</code> when it receives <code>UserClickedRestore</code>. The effect’s result comes back as <code>StorageReturnedDesign(String)</code> or <code>StorageWasEmpty</code>.</p>
          <h3>Check data at the boundary</h3>
          <p>Saved strings are outside Gleam’s type system. They could have been edited or left by an older version. A decoder checks that the JSON has the fields and types we expect before we use it.</p>
          ${code(examples.decode.source)}
          <p><code>use</code> is Gleam’s syntax for passing the rest of a block as a callback. Here it lets us read fields one after another, then combine their values. The decoder also matches the theme name to one of our three <code>Theme</code> variants.</p>
          <p><code>json.parse(saved, design_decoder())</code> returns a result: <code>Ok</code> contains a valid design; <code>Error</code> means decoding failed. The update function handles both branches. A missing or invalid design changes the feedback message and preserves what you’re currently editing.</p>
          <p>Restore is deliberate, rather than automatic at startup, so readers can see the full request → effect → result message → updated model flow.</p>
          ${files('05-restoring')}
          ${exercise(html`Save a design, change the text and colour, then restore. Your saved version should return in both the preview and the form. Refresh and restore again. For the failure path, change the saved value to invalid JSON in your browser’s storage tools; restore should report the problem without losing your current draft.`)}
        </section>

        <section class="lesson" id="subscriptions" aria-labelledby="subscriptions-title">
          <p class="eyebrow">06 / Ongoing sources of messages</p>
          <h2 id="subscriptions-title">Listen for a keyboard shortcut</h2>
          <p>An effect performs a piece of work. A subscription listens for messages over time. Our final feature lets the reader opt in to pressing <kbd>N</kbd> to cycle postcard colours.</p>
          <p>Create <code>subscriptions.mjs</code>. Its <code>nextThemeKey</code> function describes a keyboard listener, but doesn’t attach it yet. The subscription has a <code>start(emit)</code> function that attaches the listener and returns a cleanup function.</p>
          ${code(examples.cleanup.source)}
          <p>The complete listener ignores text fields, editable content, held-down keys, and modifier shortcuts. Typing an “n” into your postcard must keep working normally.</p>
          <h3>Start and stop through effects</h3>
          <p>Add <code>shortcuts: Bool</code> to the model. <code>Bool</code> has the values <code>True</code> and <code>False</code>. Toggling the checkbox returns <code>[set_shortcuts(!model.shortcuts)]</code>; <code>!</code> flips the boolean.</p>
          <p>The <code>setShortcuts</code> effect uses the runtime’s subscription manager. It starts or stops a subscription under the key <code>postcard-keys</code>. Starting an already active key does nothing, and stopping a missing key is harmless.</p>
          ${code(examples.subscribe.source)}
          <p>The start/stop effect reports success with <code>ShortcutsChanged(enabled)</code>. That message updates the checkbox’s model field. Each key press produces <code>UserPressedNextTheme</code>, which goes through the same update function as a button click. Update picks the next colour; the listener doesn’t reach into the DOM to change it.</p>
          <p>Turning shortcuts off calls the cleanup function. Stopping the app also cleans up its subscriptions, and late messages from stopped listeners are ignored. That lifecycle is what distinguishes a managed subscription from an event listener left running indefinitely.</p>
          ${files('06-subscriptions')}
          ${exercise(html`Enable shortcuts, click outside the text fields, and press N several times. Colours should cycle Coral → Ocean → Meadow → Coral. Type “nice” in the message: it should only enter text. Disable shortcuts and press N outside the fields again: the colour should stay put.`)}
        </section>

        <section class="lesson" id="keep-going" aria-labelledby="next-title">
          <p class="eyebrow">Make it yours</p>
          <h2 id="next-title">You have the whole loop</h2>
          <p>You started with a model and a view, added messages to edit it, then used effects for browser storage and a subscription for keyboard input. Each feature feeds the same update function.</p>
          <ul>
            <li>Add a signature field. Start with the model and messages, then update the view, save effect, and decoder.</li>
            <li>Add a fourth theme. Let Gleam’s exhaustive case checks help you find the functions that need another branch.</li>
            <li>Add a Reset button. Decide whether it changes only the draft or also clears the saved version; those are different operations.</li>
          </ul>
          <h3>Build and check your work</h3>
          ${code(examples.check.source)}
          <p>The tests include the finished tutorial’s state changes, storage behavior, and subscription cleanup. Run them with checkpoint 06 installed. Earlier checkpoints deliberately lack later features, so the finished-app tests won’t pass against them. The production build includes both the main demo and <code>/tutorial/</code>.</p>
          <h3>If something goes wrong</h3>
          <ul>
            <li><strong>Gleam reports a missing branch:</strong> you added a message or theme but haven’t handled it in a <code>case</code>. Use the error’s file and line number.</li>
            <li><strong>An import is missing:</strong> apply all files from the same checkpoint. The view and its Gleam messages need to match. Don’t edit files in <code>build/</code>; they’re generated.</li>
            <li><strong>The preview is blank:</strong> check the terminal and browser console. Keep the <code>tutorial-app</code> mount element and the page entry script intact.</li>
            <li><strong>You want to start over:</strong> copy checkpoint 01 again. To return to the finished app, copy checkpoint 06. The full source remains in <code>docs/tutorial/</code>.</li>
          </ul>
          <p>For more language background, explore the <a href="https://tour.gleam.run/" target="_blank" rel="noopener noreferrer">official Gleam language tour ↗<span class="sr-only"> (opens in a new tab)</span></a>. For template syntax, see <a href="https://lit.dev/docs/templates/expressions/">Lit’s expressions guide</a>. The <a href="https://github.com/bmehder/glimlit/tree/main/src/tutorial">finished app source</a> keeps the same four-file structure you built here.</p>
        </section>
      </div>
    </div>
  `, document.getElementById('guide'))
}
