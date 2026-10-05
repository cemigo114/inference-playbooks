"""Keyboard focus survives replacement of catalog controls."""
import copy

import pytest
from playwright.sync_api import expect


def focus_catalog(page, served):
    payload = copy.deepcopy(served[1])
    model = copy.deepcopy(payload['models'][0])
    other_model = copy.deepcopy(model)
    other_model.update(id='focus-other', name='Other focus model')
    first = copy.deepcopy(payload['entries'][0])
    first.update(id='focus-first', model_id=model['id'], blocked=False,
                 scope='single-node', workload_profile='a-workload')
    first['platform'] = {'stack': 'vllm', 'version': '1'}
    first['hardware']['accelerator_key'] = 'a-accelerator'
    first['notes'] = {'quickstart': [{'step': 'Start', 'detail': 'Example'}]}
    second = copy.deepcopy(first)
    second.update(id='focus-second', recipe_id='other-recipe', scope='multi-node',
                  workload_profile='b-workload')
    second['platform']['version'] = '2'
    second['hardware']['accelerator_key'] = 'b-accelerator'
    other = copy.deepcopy(first)
    other.update(id='focus-other-entry', model_id=other_model['id'])
    payload['models'] = [model, other_model]
    payload['entries'] = [first, second, other]
    page.route('**/catalog.json', lambda route: route.fulfill(json=payload))
    page.goto(served[0])
    expect(page.get_by_label('Model', exact=True)).to_be_visible()
    return payload


def keyboard_select(page, label):
    control = page.get_by_label(label, exact=True)
    control.focus()
    control.press('Enter')
    control.press('ArrowDown')
    # Commit the native dropdown's highlighted option.
    page.keyboard.press('Enter')
    expect(page.get_by_label(label, exact=True)).to_be_focused()


def test_model_keyboard_focus_and_next_tab(page, served):
    focus_catalog(page, served)
    keyboard_select(page, 'Model')
    expect(page.get_by_label('Model', exact=True)).to_have_value('focus-other')
    page.keyboard.press('Tab')
    expect(page.get_by_label('Platform/version', exact=True)).to_be_focused()


@pytest.mark.parametrize('label,next_label', [
    ('Platform/version', 'Accelerators'),
    ('Accelerators', 'Scope'),
    ('Scope', 'Workload'),
    ('Workload', 'Recipe'),
])
def test_filter_keyboard_focus_and_next_tab(page, served, label, next_label):
    focus_catalog(page, served)
    keyboard_select(page, label)
    assert page.get_by_label(label, exact=True).input_value()
    page.keyboard.press('Tab')
    expect(page.get_by_label(next_label, exact=True)).to_be_focused()


def test_recipe_keyboard_focus_and_next_tab(page, served):
    focus_catalog(page, served)
    keyboard_select(page, 'Recipe')
    expect(page.get_by_label('Recipe', exact=True)).to_have_value('focus-second')
    page.keyboard.press('Tab')
    expect(page.get_by_role('button', name='Quick start', exact=True)).to_be_focused()


@pytest.mark.parametrize('name,next_name', [
    ('Quick start', 'Configure'), ('Configure', 'Benchmark'), ('Benchmark', 'Notes'),
])
def test_tab_keyboard_focus_and_next_tab(page, served, name, next_name):
    focus_catalog(page, served)
    page.get_by_role('button', name=name, exact=True).focus()
    page.keyboard.press('Enter')
    expect(page.get_by_role('button', name=name, exact=True)).to_be_focused()
    expect(page.get_by_role('button', name=name, exact=True)).to_have_class('tab tab--active')
    page.keyboard.press('Tab')
    expect(page.get_by_role('button', name=next_name, exact=True)).to_be_focused()


def test_disappearing_filter_focus_falls_back_to_recipe(page, served):
    focus_catalog(page, served)
    page.get_by_label('Scope', exact=True).focus()
    page.evaluate("""() => {
        history.pushState(null, '', '?model=focus-other');
        dispatchEvent(new PopStateEvent('popstate'));
    }""")
    expect(page.get_by_label('Scope', exact=True)).to_have_count(0)
    expect(page.get_by_label('Recipe', exact=True)).to_be_focused()
    page.keyboard.press('Tab')
    expect(page.get_by_role('button', name='Quick start', exact=True)).to_be_focused()


def test_notes_keyboard_focus_and_next_tab(page, served):
    focus_catalog(page, served)
    page.get_by_role('button', name='Notes', exact=True).focus()
    page.keyboard.press('Enter')
    expect(page.get_by_role('button', name='Notes', exact=True)).to_be_focused()
    page.keyboard.press('Tab')
    expect(page.locator('.panel').locator('a, summary, button').first).to_be_focused()


def test_disappearing_tab_focus_falls_back_to_configure(page, served):
    focus_catalog(page, served)
    page.get_by_role('button', name='Notes', exact=True).focus()
    page.evaluate("""() => {
        CATALOG.entries.find(entry => entry.id === 'focus-other-entry').notes = null;
        history.pushState(null, '', '?model=focus-other');
        dispatchEvent(new PopStateEvent('popstate'));
    }""")
    expect(page.get_by_role('button', name='Notes', exact=True)).to_have_count(0)
    expect(page.get_by_role('button', name='Configure', exact=True)).to_be_focused()
    page.keyboard.press('Tab')
    expect(page.get_by_role('button', name='Benchmark', exact=True)).to_be_focused()
