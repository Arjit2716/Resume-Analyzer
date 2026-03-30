from resume_analyzer import save_report, is_valid_resume

text = "This is a resume of John Doe. He works as a Software Engineer and knows Python."
val = is_valid_resume(text)
print("Is valid?", val)

res = {"JD Match Analysis": "It is a 80% match.", "Resume Score": "Score: 90"}
try:
    save_report(res, "test_output.pdf")
    print("Report saved successfully!")
except Exception as e:
    import traceback
    traceback.print_exc()
