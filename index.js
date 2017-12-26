const editor = ace.edit("editor");
editor.setTheme("ace/theme/darcula");
editor.setFontSize(18);
editor.getSession().setMode("ace/mode/javascript");

const $tabs = $('#tabs');
$tabs.on('click', '.tab:not(.active)', function(){
    $(this).addClass('active').siblings('.active').removeClass('active');
});