"""Run with python3 tests/browser.py [URL]. Uses installed Python Playwright."""
import pathlib, subprocess, sys, tempfile
from playwright.sync_api import sync_playwright
project=pathlib.Path(__file__).resolve().parents[1]
url=sys.argv[1] if len(sys.argv)>1 else 'https://bettermarks.it-teaching.de/'
with tempfile.TemporaryDirectory() as temp, sync_playwright() as p:
    fixture=pathlib.Path(temp)/'testklasse.xlsx'
    mapping=pathlib.Path(temp)/'namen.xlsx'
    subprocess.run(['node',str(project/'tests/fixture.cjs'),str(fixture),str(mapping)],check=True)
    browser=p.chromium.launch(headless=True)
    page=browser.new_page(accept_downloads=True)
    errors=[]
    page.on('pageerror',lambda error:errors.append(str(error)))
    page.goto(url)
    page.locator('#file').set_input_files(str(fixture))
    page.locator('#results').wait_for(state='visible')
    assert page.locator('#tbody tr').count()==4
    assert page.locator('#tbody tr').nth(1).locator('button').all_text_contents()==['--','--']
    # Select individual activity columns: only the checked ones affect Gesamt.
    assert page.locator('#tbody tr').nth(2).locator('td.total').inner_text()=='4,00'
    page.locator('#activity-selection summary').click()
    page.locator('#activity-list input').nth(1).uncheck()
    assert page.locator('#tbody tr').nth(2).locator('td.total').inner_text()=='2,00'
    assert page.locator('#thead th.excluded').count()==1
    page.locator('#select-none').click()
    assert page.locator('#tbody tr').nth(2).locator('td.total').inner_text()=='–'
    page.locator('#selection-range').fill('1')
    page.locator('#select-recent').click()
    assert page.locator('#activity-list input').nth(0).is_checked()
    assert not page.locator('#activity-list input').nth(1).is_checked()
    assert page.locator('#tbody tr').nth(2).locator('td.total').inner_text()=='2,00'
    with page.expect_download() as subset_download:
        page.locator('#csv').click()
    subset_csv=pathlib.Path(subset_download.value.path()).read_text(encoding='utf-8-sig')
    assert '"Für Gesamt ausgewählt";"1. Neues Thema"' in subset_csv
    assert '1 von 2 Aktivitäten ausgewählt' in subset_csv
    page.locator('#selection-range').fill('2-2')
    page.locator('#select-recent').click()
    assert page.locator('#tbody tr').nth(2).locator('td.total').inner_text()=='6,00'
    page.locator('#selection-range').fill('1, 2')
    page.locator('#selection-range').press('Enter')
    assert page.locator('#tbody tr').nth(2).locator('td.total').inner_text()=='4,00'
    page.locator('#select-all').click()
    assert page.locator('#tbody tr').nth(2).locator('td.total').inner_text()=='4,00'
    page.locator('#activity-selection summary').click()
    page.locator('#display').select_option('grades')
    assert page.locator('#symbol-key').is_hidden()
    assert page.locator('#tbody tr').nth(1).locator('button').all_text_contents()==['6','6']
    assert page.locator('#tbody tr').nth(3).locator('td.total').inner_text()=='6,00'
    page.locator('#settings summary').click()
    page.locator('#exclude-empty').check()
    assert page.locator('#tbody tr').nth(1).locator('td.total').inner_text()=='–'
    page.locator('#basis').select_option('success')
    page.locator('#use-four').check()
    page.locator('#two').fill('40')
    assert page.locator('#settings-error').is_visible()
    assert page.locator('#csv').is_disabled()
    page.locator('#two').fill('80')
    assert page.locator('#settings-error').is_hidden()
    page.locator('#sort').select_option('best')
    assert page.locator('#tbody tr').first.locator('th').inner_text()=='Anna Beispiel'
    page.locator('#search').fill('Anna')
    assert page.locator('#tbody tr').count()==1
    with page.expect_download() as download:
        page.locator('#csv').click()
    exported=pathlib.Path(download.value.path()).read_text(encoding='utf-8-sig')
    assert 'Ben Beispiel' in exported and 'Dana Beispiel' in exported
    assert 'Notenschlüssel' in exported and 'Durchschnitt' in exported and 'Erfolgsquote' in exported
    page.locator('#tbody button').first.click()
    assert page.locator('#detail-list li').count()==2
    assert 'Erste Übung' in page.locator('#detail-list').inner_text()
    page.locator('#detail button').click()
    page.locator('#file').set_input_files({'name':'broken.xlsx','mimeType':'application/octet-stream','buffer':b'broken'})
    page.wait_for_function("() => document.getElementById('message').textContent.includes('vorherige Auswertung')")
    assert page.locator('#results').is_visible()
    page.locator('#reset').click()
    assert page.locator('#detail-title').text_content()==''
    assert page.locator('#detail-list').text_content()==''
    assert page.locator('#results').is_hidden()
    page.locator('#file').set_input_files(str(fixture))
    page.locator('#results').wait_for(state='visible')
    assert page.locator('#activity-list input:checked').count()==2
    page.set_viewport_size({'width':390,'height':844})
    assert not page.evaluate('document.documentElement.scrollWidth > innerWidth'), 'Mobile viewport overflows'
    assert not errors, errors
    # Mapping can be loaded first and is applied to table, search and CSV.
    other=browser.new_page(accept_downloads=True)
    other.on('pageerror',lambda error:errors.append(str(error)))
    other.goto(url)
    other.locator('#name-mapping summary').click()
    with other.expect_download() as template_download:
        other.locator('a[download]').click()
    assert template_download.value.suggested_filename=='namenszuordnung-vorlage.xlsx'
    other.locator('#names-file').set_input_files(str(mapping))
    other.wait_for_function("() => document.getElementById('names-status').textContent.includes('Zuordnungen geladen')")
    other.locator('#file').set_input_files(str(fixture))
    other.locator('#results').wait_for(state='visible')
    assert other.locator('#tbody th').first.inner_text()=='Aneliese Lutaku'
    assert '1 Kürzel nicht gefunden' in other.locator('#names-status').inner_text()
    assert other.locator('#tbody tr').nth(2).locator('button').first.inner_text()=='~'
    other.locator('#search').fill('Lutaku')
    assert other.locator('#tbody tr').count()==1
    with other.expect_download() as named_download:
        other.locator('#csv').click()
    assert 'Aneliese Lutaku' in pathlib.Path(named_download.value.path()).read_text(encoding='utf-8-sig')
    other.locator('#remove-names').click()
    assert other.locator('#tbody th').first.inner_text()=='Anna Beispiel'
    other.locator('#names-file').set_input_files(str(mapping))
    other.wait_for_function("() => document.getElementById('names-status').textContent.includes('1 Namen zugeordnet')")
    assert other.locator('#tbody th').first.inner_text()=='Aneliese Lutaku'
    other.locator('#reset').click()
    assert other.locator('#names-status').inner_text()==''
    other.locator('#file').set_input_files(str(fixture))
    other.locator('#results').wait_for(state='visible')
    assert other.locator('#tbody th').first.inner_text()=='Anna Beispiel'
    assert not errors, errors
    browser.close()
    print('Browserprüfungen erfolgreich: Worker-Import, alle Schüler, 0 %, Noten, Optionen, Sortierung, CSV, Dialog, Fehler, Reset und mobile Breite.')
